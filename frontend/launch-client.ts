import { Connection, Keypair, Transaction } from "@solana/web3.js";

type Asset = { mint: string; symbol: string | null; name: string | null };
type WalletProvider = {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction?(transaction: Transaction): Promise<{ signature: string }>;
  signTransaction?(transaction: Transaction): Promise<Transaction>;
  signAllTransactions?(transactions: Transaction[]): Promise<Transaction[]>;
};

declare global {
  interface Window {
    solana?: WalletProvider & { isPhantom?: boolean };
    solflare?: WalletProvider;
  }
}

const rpc = "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpc, "confirmed");

function el<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function walletProvider() {
  return window.solana ?? window.solflare ?? null;
}

function setStatus(message: string, state: "idle" | "working" | "error" | "success" = "idle") {
  let status = el<HTMLParagraphElement>("#tl-status");
  if (!status) {
    status = document.createElement("p");
    status.id = "tl-status";
    status.className = "pg-note";
    el(".tl-foot")?.appendChild(status);
  }
  status.textContent = message;
  status.style.color = state === "error" ? "#b42318" : state === "success" ? "#267a33" : "#495057";
}

function selectedSymbol(select: HTMLSelectElement) {
  return select.selectedOptions[0]?.dataset.symbol ?? select.selectedOptions[0]?.textContent?.split(" — ")[0] ?? "—";
}

function syncPreview() {
  const buy = el<HTMLSelectElement>("#tl-buy");
  const sell = el<HTMLSelectElement>("#tl-sell");
  if (!buy || !sell) return;
  const buySymbol = selectedSymbol(buy);
  const sellSymbol = selectedSymbol(sell);
  for (const selector of ["#tl-p-buy", "#tl-s-buy"]) {
    const target = el(selector);
    if (target) target.textContent = buySymbol;
  }
  for (const selector of ["#tl-p-sell", "#tl-s-sell"]) {
    const target = el(selector);
    if (target) target.textContent = sellSymbol;
  }
}

function fillSelect(select: HTMLSelectElement, assets: Asset[], preferredSymbol: string) {
  select.replaceChildren(...assets.map((asset) => {
    const option = document.createElement("option");
    option.value = asset.mint;
    option.dataset.symbol = asset.symbol ?? "";
    option.textContent = asset.symbol ? `${asset.symbol} — ${asset.name ?? "Supported asset"}` : asset.mint;
    option.selected = asset.symbol === preferredSymbol;
    return option;
  }));
  if (select.selectedIndex < 0) select.selectedIndex = 0;
}

async function loadAssets() {
  const response = await fetch("/api/assets");
  if (!response.ok) throw new Error("Could not load Pump-supported assets");
  const payload = await response.json() as { assets: Asset[] };
  const buy = el<HTMLSelectElement>("#tl-buy");
  const sell = el<HTMLSelectElement>("#tl-sell");
  const box = el<HTMLElement>(".tl-box");
  const sides = el<HTMLElement>(".tl-sides");
  if (!buy || !sell || !box || !sides) return;

  const pairField = document.createElement("div");
  pairField.className = "tl-field";
  const label = document.createElement("label");
  label.className = "tl-side-label";
  label.htmlFor = "tl-pair";
  label.textContent = "Pump trading pair";
  const selectWrap = document.createElement("div");
  selectWrap.className = "tl-select";
  const pair = document.createElement("select");
  pair.id = "tl-pair";
  selectWrap.appendChild(pair);
  pairField.append(label, selectWrap);
  box.insertBefore(pairField, sides);

  fillSelect(pair, payload.assets, "SOL");
  fillSelect(buy, payload.assets, "TSLAX");
  fillSelect(sell, payload.assets, "SPCX");
  buy.addEventListener("change", syncPreview);
  sell.addEventListener("change", syncPreview);
  syncPreview();
  setStatus(`${payload.assets.length} live Pump-supported assets loaded.`);
}

async function json(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? payload.code ?? `Request failed (${response.status})`);
  return payload;
}

async function launch(provider: WalletProvider, authority: string) {
  const name = el<HTMLInputElement>("#tl-name")?.value.trim() ?? "";
  const symbol = el<HTMLInputElement>("#tl-ticker")?.value.trim().toUpperCase() ?? "";
  const description = el<HTMLTextAreaElement>("#tl-desc")?.value.trim() ?? "";
  const image = el<HTMLInputElement>("#tl-image")?.files?.[0];
  const pair = el<HTMLSelectElement>("#tl-pair")?.value;
  const buy = el<HTMLSelectElement>("#tl-buy")?.value;
  const sell = el<HTMLSelectElement>("#tl-sell")?.value;
  const terms = el<HTMLInputElement>(".tl-check input")?.checked;
  const social = [...document.querySelectorAll<HTMLInputElement>(".tl-details-body input")];
  if (!name || !symbol || !image || !pair || !buy || !sell) throw new Error("Add a name, ticker, image, pair, and both fee assets.");
  if (!terms) throw new Error("Accept the Terms of Use and Disclosures before launching.");
  if (image.size > 5 * 1024 * 1024) throw new Error("Token image must be 5 MB or smaller.");

  const parameters = {
    name,
    symbol,
    canonicalPairMint: pair,
    buyFeeAssetMint: buy,
    sellFeeAssetMint: sell,
    protocolShareBps: 0,
  };
  setStatus("Validating the Pump pair and fee routes…", "working");
  const quote = await json(await fetch("/api/launch/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parameters),
  }));
  if (!quote.executionReady) throw new Error("Mainnet beta is locked until the custody program canary finishes.");

  setStatus("Uploading token image and metadata…", "working");
  const metadata = new FormData();
  metadata.set("image", image);
  metadata.set("name", name);
  metadata.set("symbol", symbol);
  metadata.set("description", description);
  metadata.set("twitter", social[0]?.value.trim() ?? "");
  metadata.set("telegram", social[1]?.value.trim() ?? "");
  metadata.set("website", social[2]?.value.trim() ?? "");
  const uploaded = await json(await fetch("/api/metadata", { method: "POST", body: metadata }));

  setStatus("Building the Pump.fun launch transaction…", "working");
  const mint = Keypair.generate();
  const built = await json(await fetch("/api/launch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...parameters,
      authority,
      mint: mint.publicKey.toBase58(),
      metadataUri: uploaded.uri,
      maxSlippageBps: 100,
    }),
  }));
  const phases = built.transactions as Array<{
    kind: "CREATE_TOKEN" | "CONFIGURE_DIRECTIONAL_FEES";
    transaction: string;
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
  if (!Array.isArray(phases) || phases.length !== 2) throw new Error("Launch builder returned an invalid transaction set.");
  const transactions = phases.map((phase) => Transaction.from(
    Uint8Array.from(atob(phase.transaction), (character) => character.charCodeAt(0)),
  ));
  transactions[0].partialSign(mint);

  setStatus("Approve token creation and fee setup in your wallet…", "working");
  if (provider.signAndSendTransaction) {
    for (let index = 0; index < transactions.length; index++) {
      setStatus(index === 0 ? "Create the token in your wallet…" : "Confirm the fee settings…", "working");
      const signature = (await provider.signAndSendTransaction(transactions[index])).signature;
      await connection.confirmTransaction({ signature, blockhash: phases[index].blockhash, lastValidBlockHeight: phases[index].lastValidBlockHeight }, "confirmed");
    }
  } else if (provider.signAllTransactions) {
    const signed = await provider.signAllTransactions(transactions);
    for (let index = 0; index < signed.length; index++) {
      setStatus(index === 0 ? "Creating token on Pump.fun…" : "Saving directional fee settings…", "working");
      const signature = await connection.sendRawTransaction(signed[index].serialize(), { maxRetries: 3, skipPreflight: false });
      await connection.confirmTransaction({ signature, blockhash: phases[index].blockhash, lastValidBlockHeight: phases[index].lastValidBlockHeight }, "confirmed");
    }
  } else if (provider.signTransaction) {
    for (let index = 0; index < transactions.length; index++) {
      const signed = await provider.signTransaction(transactions[index]);
      const signature = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3, skipPreflight: false });
      await connection.confirmTransaction({ signature, blockhash: phases[index].blockhash, lastValidBlockHeight: phases[index].lastValidBlockHeight }, "confirmed");
    }
  } else throw new Error("This wallet cannot sign Solana transactions.");
  setStatus(`Launch confirmed. Mint: ${built.mint}`, "success");
}

async function setup() {
  const button = el<HTMLButtonElement>(".tl-submit");
  const buyIn = el<HTMLInputElement>("#tl-buyin");
  if (buyIn) {
    buyIn.disabled = true;
    buyIn.placeholder = "Available after beta launch";
  }
  try {
    await loadAssets();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Asset loading failed", "error");
  }
  if (!button) return;
  button.addEventListener("click", async () => {
    const provider = walletProvider();
    if (!provider) {
      setStatus("Install Phantom or Solflare to launch on Solana.", "error");
      return;
    }
    button.disabled = true;
    try {
      const connected = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const authority = connected.publicKey.toString();
      button.textContent = "Sign and launch";
      await launch(provider, authority);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Launch failed", "error");
    } finally {
      button.disabled = false;
    }
  });
}

void setup();
