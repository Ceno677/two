use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    pubkey,
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("3LLHFB9w9FVXYRUbfVa1ioW6C8v4Txt6C8c474xbV3uU");

const JUPITER_V6: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const MAX_PROTOCOL_SHARE_BPS: u16 = 2_000;
const MAX_SLIPPAGE_BPS: u16 = 500;

#[program]
pub mod directional_fees {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, args: InitializeConfigArgs) -> Result<()> {
        require!(args.routing_threshold_raw > 0, DirectionalFeeError::InvalidThreshold);
        require!(args.max_batch_interval_secs > 0, DirectionalFeeError::InvalidInterval);
        require!(args.protocol_share_bps <= MAX_PROTOCOL_SHARE_BPS, DirectionalFeeError::InvalidProtocolShare);
        require!(args.max_slippage_bps > 0 && args.max_slippage_bps <= MAX_SLIPPAGE_BPS, DirectionalFeeError::InvalidSlippage);
        require_keys_neq!(args.canonical_pair_mint, Pubkey::default(), DirectionalFeeError::InvalidMint);
        require_keys_neq!(args.buy_fee_asset_mint, Pubkey::default(), DirectionalFeeError::InvalidMint);
        require_keys_neq!(args.sell_fee_asset_mint, Pubkey::default(), DirectionalFeeError::InvalidMint);

        let config = &mut ctx.accounts.config;
        config.token_mint = ctx.accounts.token_mint.key();
        config.authority = ctx.accounts.authority.key();
        config.route_authority = args.route_authority;
        config.canonical_pair_mint = args.canonical_pair_mint;
        config.buy_fee_asset_mint = args.buy_fee_asset_mint;
        config.sell_fee_asset_mint = args.sell_fee_asset_mint;
        config.buy_destination = args.buy_destination;
        config.sell_destination = args.sell_destination;
        config.routing_threshold_raw = args.routing_threshold_raw;
        config.max_batch_interval_secs = args.max_batch_interval_secs;
        config.protocol_share_bps = args.protocol_share_bps;
        config.max_slippage_bps = args.max_slippage_bps;
        config.enabled = true;
        config.paused = true;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminConfig>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    pub fn set_route_authority(ctx: Context<AdminConfig>, route_authority: Pubkey) -> Result<()> {
        require_keys_neq!(route_authority, Pubkey::default(), DirectionalFeeError::InvalidAuthority);
        ctx.accounts.config.route_authority = route_authority;
        Ok(())
    }

    /// Executes one pre-authorized exact-input Jupiter route. The receipt PDA
    /// makes the batch id single-use. Output and spend are verified after CPI.
    pub fn execute_route(ctx: Context<ExecuteRoute>, args: ExecuteRouteArgs) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.enabled && !config.paused, DirectionalFeeError::RoutingPaused);
        require!(Clock::get()?.slot <= args.expiry_slot, DirectionalFeeError::RouteExpired);
        require!(args.amount_in > 0 && args.minimum_output > 0, DirectionalFeeError::InvalidRouteAmount);
        require_keys_eq!(ctx.accounts.route_authority.key(), config.route_authority, DirectionalFeeError::UnauthorizedRouter);
        require_keys_eq!(ctx.accounts.jupiter_program.key(), JUPITER_V6, DirectionalFeeError::InvalidRouterProgram);
        require_keys_eq!(ctx.accounts.input_vault.mint, config.canonical_pair_mint, DirectionalFeeError::InvalidInputMint);
        require_keys_eq!(ctx.accounts.input_vault.owner, config.key(), DirectionalFeeError::InvalidVaultAuthority);

        let (output_mint, destination) = match args.side {
            TradeSide::Buy => (config.buy_fee_asset_mint, config.buy_destination),
            TradeSide::Sell => (config.sell_fee_asset_mint, config.sell_destination),
        };
        require_keys_eq!(ctx.accounts.output_vault.mint, output_mint, DirectionalFeeError::InvalidOutputMint);
        require_keys_eq!(ctx.accounts.output_vault.owner, destination, DirectionalFeeError::InvalidDestination);

        let input_before = ctx.accounts.input_vault.amount;
        let output_before = ctx.accounts.output_vault.amount;
        require!(input_before >= args.amount_in, DirectionalFeeError::InsufficientRawFees);

        require!(ctx.remaining_accounts.iter().any(|account| account.key() == config.key()), DirectionalFeeError::MissingConfigSigner);
        let metas = ctx.remaining_accounts.iter().map(|account| {
            let is_config = account.key() == config.key();
            if account.is_writable {
                AccountMeta::new(account.key(), is_config)
            } else {
                AccountMeta::new_readonly(account.key(), is_config)
            }
        }).collect::<Vec<_>>();
        let instruction = Instruction { program_id: JUPITER_V6, accounts: metas, data: args.jupiter_instruction_data };
        let mut infos = ctx.remaining_accounts.to_vec();
        infos.push(ctx.accounts.jupiter_program.to_account_info());
        let token_mint = config.token_mint;
        let bump = [config.bump];
        let signer_seeds: &[&[u8]] = &[b"directional-fee", token_mint.as_ref(), &bump];
        invoke_signed(&instruction, &infos, &[signer_seeds])?;

        ctx.accounts.input_vault.reload()?;
        ctx.accounts.output_vault.reload()?;
        let spent = input_before.checked_sub(ctx.accounts.input_vault.amount).ok_or(DirectionalFeeError::InvalidSettlement)?;
        let received = ctx.accounts.output_vault.amount.checked_sub(output_before).ok_or(DirectionalFeeError::InvalidSettlement)?;
        require!(spent > 0 && spent <= args.amount_in, DirectionalFeeError::ExcessiveInputSpent);
        require!(received >= args.minimum_output, DirectionalFeeError::MinimumOutputNotMet);

        let receipt = &mut ctx.accounts.receipt;
        receipt.config = config.key();
        receipt.batch_id = args.batch_id;
        receipt.side = args.side;
        receipt.input_mint = config.canonical_pair_mint;
        receipt.output_mint = output_mint;
        receipt.input_amount = spent;
        receipt.output_amount = received;
        receipt.settled_slot = Clock::get()?.slot;
        receipt.bump = ctx.bumps.receipt;
        emit!(RouteSettled { config: config.key(), batch_id: args.batch_id, side: args.side, input_amount: spent, output_amount: received });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    pub token_mint: InterfaceAccount<'info, Mint>,
    #[account(init, payer = authority, space = 8 + DirectionalFeeConfig::INIT_SPACE, seeds = [b"directional-fee", token_mint.key().as_ref()], bump)]
    pub config: Account<'info, DirectionalFeeConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)] pub config: Account<'info, DirectionalFeeConfig>,
}

#[derive(Accounts)]
#[instruction(args: ExecuteRouteArgs)]
pub struct ExecuteRoute<'info> {
    #[account(seeds = [b"directional-fee", config.token_mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, DirectionalFeeConfig>,
    #[account(mut)] pub route_authority: Signer<'info>,
    #[account(mut)] pub input_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)] pub output_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: constrained to the audited Jupiter v6 program id in the handler.
    pub jupiter_program: UncheckedAccount<'info>,
    #[account(init, payer = route_authority, space = 8 + RouteReceipt::INIT_SPACE, seeds = [b"route-receipt", config.key().as_ref(), args.batch_id.as_ref()], bump)]
    pub receipt: Account<'info, RouteReceipt>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct DirectionalFeeConfig {
    pub token_mint: Pubkey,
    pub authority: Pubkey,
    pub route_authority: Pubkey,
    pub canonical_pair_mint: Pubkey,
    pub buy_fee_asset_mint: Pubkey,
    pub sell_fee_asset_mint: Pubkey,
    pub buy_destination: Pubkey,
    pub sell_destination: Pubkey,
    pub routing_threshold_raw: u64,
    pub max_batch_interval_secs: u32,
    pub protocol_share_bps: u16,
    pub max_slippage_bps: u16,
    pub enabled: bool,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RouteReceipt {
    pub config: Pubkey,
    pub batch_id: [u8; 32],
    pub side: TradeSide,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_amount: u64,
    pub output_amount: u64,
    pub settled_slot: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeConfigArgs {
    pub route_authority: Pubkey,
    pub canonical_pair_mint: Pubkey,
    pub buy_fee_asset_mint: Pubkey,
    pub sell_fee_asset_mint: Pubkey,
    pub buy_destination: Pubkey,
    pub sell_destination: Pubkey,
    pub routing_threshold_raw: u64,
    pub max_batch_interval_secs: u32,
    pub protocol_share_bps: u16,
    pub max_slippage_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteRouteArgs {
    pub batch_id: [u8; 32],
    pub side: TradeSide,
    pub amount_in: u64,
    pub minimum_output: u64,
    pub expiry_slot: u64,
    pub jupiter_instruction_data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum TradeSide { Buy, Sell }

#[event]
pub struct RouteSettled {
    pub config: Pubkey,
    pub batch_id: [u8; 32],
    pub side: TradeSide,
    pub input_amount: u64,
    pub output_amount: u64,
}

#[error_code]
pub enum DirectionalFeeError {
    #[msg("Routing is paused")] RoutingPaused,
    #[msg("Route quote expired")] RouteExpired,
    #[msg("Invalid route amount")] InvalidRouteAmount,
    #[msg("Unauthorized route authority")] UnauthorizedRouter,
    #[msg("Invalid router program")] InvalidRouterProgram,
    #[msg("Invalid input mint")] InvalidInputMint,
    #[msg("Invalid output mint")] InvalidOutputMint,
    #[msg("Invalid destination")] InvalidDestination,
    #[msg("Invalid vault authority")] InvalidVaultAuthority,
    #[msg("Insufficient raw creator fees")] InsufficientRawFees,
    #[msg("Route spent more than authorized")] ExcessiveInputSpent,
    #[msg("Minimum output was not met")] MinimumOutputNotMet,
    #[msg("Invalid settlement balance delta")] InvalidSettlement,
    #[msg("Invalid routing threshold")] InvalidThreshold,
    #[msg("Invalid batching interval")] InvalidInterval,
    #[msg("Invalid protocol share")] InvalidProtocolShare,
    #[msg("Invalid slippage")] InvalidSlippage,
    #[msg("Invalid mint")] InvalidMint,
    #[msg("Invalid authority")] InvalidAuthority,
    #[msg("The route does not include the config PDA signer")] MissingConfigSigner,
}
