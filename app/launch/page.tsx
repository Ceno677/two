"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImagePlus, LoaderCircle, ShieldCheck } from "lucide-react";
import { ASSETS } from "@/lib/data";

const steps = ["Token", "Pump", "Fees", "Destination", "Review", "Launch"];
type AssetOption = { mint: string; symbol: string | null; name: string | null };

const knownAssets: AssetOption[] = Object.values(ASSETS)
  .filter((asset) => asset.chain === "solana")
  .map(({ mint, symbol, name }) => ({ mint, symbol, name }));

export default function LaunchPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegram, setTelegram] = useState("");
  const [imageName, setImageName] = useState("");
  const [pairMint, setPairMint] = useState(ASSETS.SOL.mint);
  const [buyMint, setBuyMint] = useState(ASSETS.TSLAX.mint);
  const [sellMint, setSellMint] = useState(ASSETS.SPCX.mint);
  const [pumpAssets, setPumpAssets] = useState<AssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/assets")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { assets: AssetOption[] }) => { if (active) setPumpAssets(data.assets); })
      .catch(() => { if (active) setPumpAssets(knownAssets); })
      .finally(() => { if (active) setAssetsLoading(false); });
    return () => { active = false; };
  }, []);

  const assetMap = useMemo(() => new Map([...knownAssets, ...pumpAssets].map((asset) => [asset.mint, asset])), [pumpAssets]);
  const pair = assetMap.get(pairMint);
  const buy = assetMap.get(buyMint);
  const sell = assetMap.get(sellMint);
  const pairLabel = pair?.symbol ?? shortMint(pairMint);
  const buyLabel = buy?.symbol ?? shortMint(buyMint);
  const sellLabel = sell?.symbol ?? shortMint(sellMint);
  const canContinue = step !== 0 || Boolean(name.trim() && symbol.trim());

  return <main className="shell">
    <div className="grid min-h-[calc(100vh-65px)] border-x border-b hairline lg:grid-cols-[280px_1fr]">
      <aside className="border-b p-6 hairline lg:border-b-0 lg:border-r lg:p-8">
        <div className="eyebrow">Launch sequence</div>
        <ol className="mt-7 grid grid-cols-3 gap-1 lg:grid-cols-1">{steps.map((label, index) => <li key={label}><button onClick={() => setStep(index)} className={`focus-ring flex w-full items-center gap-3 px-3 py-3 text-left text-xs ${index === step ? "bg-[#191e23] text-white" : "text-[#626b73]"}`}><span className={`mono grid h-5 w-5 place-items-center border text-[9px] ${index < step ? "border-[#315944] text-[#61c997]" : index === step ? "border-[#6d747a]" : "hairline"}`}>{index < step ? <Check size={10}/> : index + 1}</span>{label}</button></li>)}</ol>
        <div className="mt-16 hidden gap-3 border-t pt-5 hairline lg:flex"><ShieldCheck size={16} className="text-[#7fa9c7]"/><p className="text-[11px] leading-5 text-[#697279]">You choose every token and fee parameter. No private keys leave your wallet.</p></div>
      </aside>

      <div className="grid xl:grid-cols-[1fr_340px]">
        <section className="p-6 sm:p-10 lg:p-14">
          <div className="eyebrow">Step {step + 1} / {steps.length}</div>
          <h1 className="mt-4 text-3xl tracking-[-.04em] sm:text-4xl">{titleFor(step)}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#778087]">{step === 2 ? "Choose where buy- and sell-generated creator fees convert. Traders still receive normal Pump outputs." : "Configure your own token. The examples on the markets page are illustrative, not fixed launch presets."}</p>

          <div className="mt-10 max-w-2xl">
            {step === 0 && <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Token name" value={name} onChange={setName} placeholder="e.g. Orbit"/>
              <Field label="Ticker" value={symbol} onChange={(value) => setSymbol(value.toUpperCase().slice(0, 13))} placeholder="ORBIT"/>
              <label className="sm:col-span-2"><span className="eyebrow">Token image</span><span className="focus-ring mt-2 flex h-24 items-center justify-center gap-3 border border-dashed hairline bg-[#0f1216] text-xs text-[#727b82]"><ImagePlus size={17}/>{imageName || "Choose PNG, JPG, or WebP"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageName(event.target.files?.[0]?.name ?? "")}/></span></label>
              <label className="sm:col-span-2"><span className="eyebrow">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="focus-ring mt-2 h-28 w-full resize-none border hairline bg-[#0f1216] p-4 text-sm outline-none" placeholder="What is this token?"/></label>
              <Field label="Website" value={website} onChange={setWebsite} placeholder="https://"/><Field label="X / Twitter" value={xUrl} onChange={setXUrl} placeholder="https://x.com/"/><Field label="Telegram" value={telegram} onChange={setTelegram} placeholder="https://t.me/"/>
            </div>}

            {step === 1 && <div><AssetSelect label="Canonical Pump trading pair" value={pairMint} onChange={setPairMint} assets={pumpAssets.length ? pumpAssets : knownAssets}/><div className="mt-3 flex items-center gap-2 mono text-[9px] text-[#636c73]">{assetsLoading && <LoaderCircle className="animate-spin" size={11}/>} {assetsLoading ? "CHECKING PUMP ONCHAIN SUPPORTED MINTS" : "VERIFIED AGAINST PUMP SUPPORTED QUOTE MINTS"}</div></div>}

            {step === 2 && <div className="space-y-4"><AssetSelect label="Buy-generated creator fees convert to" value={buyMint} onChange={setBuyMint} assets={pumpAssets.length ? pumpAssets : knownAssets}/><AssetSelect label="Sell-generated creator fees convert to" value={sellMint} onChange={setSellMint} assets={pumpAssets.length ? pumpAssets : knownAssets}/><div className="mono flex items-center gap-2 text-[9px] text-[#636c73]">{assetsLoading && <LoaderCircle className="animate-spin" size={11}/>} {assetsLoading ? "LOADING DESTINATION ASSETS" : `${pumpAssets.length} PUMP-SUPPORTED ASSETS — LIVE ROUTE REQUIRED BEFORE LAUNCH`}</div><div className="grid grid-cols-2 border hairline bg-[#0d1013]"><RoutePreview side="BUY" pair={pairLabel} asset={buyLabel}/><RoutePreview side="SELL" pair={pairLabel} asset={sellLabel} border/></div></div>}

            {step === 3 && <div className="border hairline p-5"><div className="eyebrow">MVP destination</div><div className="mt-3 text-sm">Token treasury vault</div><p className="mt-3 text-xs leading-5 text-[#707980]">A deterministic, token-specific program vault. Wallet, multisig, burn, staking, and LP destinations remain disabled until the single-output vault is verified.</p></div>}

            {step >= 4 && <Review name={name} symbol={symbol} pair={pairLabel} buy={buyLabel} sell={sellLabel}/>}
          </div>

          <div className="mt-12 flex items-center gap-3"><button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="focus-ring grid h-11 w-11 place-items-center border hairline disabled:opacity-30"><ArrowLeft size={15}/></button><button disabled={!canContinue} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} className="focus-ring flex h-11 items-center gap-3 bg-[#e9e9e4] px-6 text-xs font-semibold text-[#090b0e] disabled:cursor-not-allowed disabled:opacity-35">{step === steps.length - 1 ? "Connect wallet" : "Continue"}<ArrowRight size={14}/></button></div>
        </section>

        <aside className="border-t bg-[#0d1013] p-6 hairline sm:p-8 xl:border-l xl:border-t-0"><div className="eyebrow">Live configuration</div><div className="mt-7 border hairline bg-[#0f1216]"><div className="border-b p-5 hairline"><div className="text-2xl tracking-[-.04em]">${symbol || "YOUR TOKEN"}</div><div className="mono mt-2 text-[10px] text-[#687178]">{symbol || "TOKEN"} / {pairLabel}</div></div><RoutePreview side="BUY" pair={pairLabel} asset={buyLabel}/><RoutePreview side="SELL" pair={pairLabel} asset={sellLabel} borderTop/></div><div className="mt-5 border p-4 hairline"><Row label="Protocol share" value="5.00%"/><div className="mt-3"><Row label="Route trigger" value={`0.05 ${pairLabel} / 30m`}/></div></div><p className="mono mt-5 text-[9px] leading-5 text-[#596169]">ALL MINTS ARE REVALIDATED SERVER-SIDE AT QUOTE AND LAUNCH TIME.</p></aside>
      </div>
    </div>
  </main>;
}

function shortMint(mint: string) { return mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : "SELECT"; }
function titleFor(step: number) { return ["Define your token", "Choose the Pump market", "Choose fee directions", "Choose custody", "Verify every parameter", "Sign and launch"][step]; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label><span className="eyebrow">{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 h-12 w-full border hairline bg-[#0f1216] px-4 text-sm outline-none placeholder:text-[#42494f]"/></label>; }
function AssetSelect({ label, value, onChange, assets }: { label: string; value: string; onChange: (value: string) => void; assets: AssetOption[] }) { return <label className="block"><span className="eyebrow">{label}</span><div className="relative mt-2"><select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring h-14 w-full appearance-none border hairline bg-[#0f1216] px-4 pr-12 text-sm outline-none">{assets.map((asset) => <option value={asset.mint} key={asset.mint}>{asset.symbol ? `${asset.symbol} — ${asset.name}` : asset.mint}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-4 top-5 text-[#697279]"/></div><div className="mono mt-2 truncate text-[9px] text-[#555e65]">MINT {value}</div></label>; }
function RoutePreview({ side, pair, asset, border, borderTop }: { side: "BUY" | "SELL"; pair: string; asset: string; border?: boolean; borderTop?: boolean }) { const isBuy = side === "BUY"; return <div className={`p-4 ${border ? "border-l" : ""} ${borderTop ? "border-t" : ""} hairline`}><div className={`eyebrow ${isBuy ? "text-[#61c997]!" : "text-[#df6b62]!"}`}>{side} fees</div><div className="mono mt-3 text-xs">{pair} <span className="mx-2 text-[#596169]">→</span> {asset}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between text-xs"><span className="text-[#747d84]">{label}</span><span className="mono">{value}</span></div>; }
function Review({ name, symbol, pair, buy, sell }: { name: string; symbol: string; pair: string; buy: string; sell: string }) { return <div className="divide-y divide-[#272d33] border hairline">{[["Token", name ? `${name} / $${symbol}` : "Not configured"], ["Trading pair", pair], ["Buy creator fees", `${pair} → ${buy}`], ["Sell creator fees", `${pair} → ${sell}`], ["Destination", `${symbol || "Token"} treasury`], ["Protocol share", "5.00%"]].map(([label, value]) => <div className="flex justify-between gap-6 p-4 text-sm" key={label}><span className="text-[#717a81]">{label}</span><span className="mono text-right text-xs">{value}</span></div>)}</div>; }
