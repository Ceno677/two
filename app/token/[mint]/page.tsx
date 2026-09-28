import { notFound } from "next/navigation";
import { ExternalLink, TimerReset } from "lucide-react";
import { TOKENS, formatUsd } from "@/lib/data";
import { FeeStream } from "@/components/fee-stream";

const history = [
  { side: "BUY", input: "0.071 SOL", output: "18.40 TSLAX", age: "2m", tx: "5sGK…o8n1" },
  { side: "SELL", input: "0.052 SOL", output: "7.20 SPCX", age: "11m", tx: "3pLR…aQ92" },
  { side: "BUY", input: "0.064 SOL", output: "16.91 TSLAX", age: "24m", tx: "8xNk…r7K4" },
  { side: "SELL", input: "0.083 SOL", output: "11.38 SPCX", age: "38m", tx: "2mQz…3sJ5" },
];

export default async function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const token = TOKENS.find((item) => item.mint === mint);
  if (!token) notFound();
  return <main className="shell">
    <section className="border-x border-b hairline">
      <div className="grid md:grid-cols-[1.5fr_1fr] border-b hairline">
        <div className="p-6 sm:p-9 md:border-r hairline"><div className="flex items-start justify-between"><div><div className="eyebrow">{token.symbol} / {token.canonicalPair.symbol}</div><h1 className="mt-4 text-4xl sm:text-6xl tracking-[-.055em]">${token.symbol}</h1><p className="mt-2 text-sm text-[#778087]">{token.name} · launched {token.age} ago</p></div><div className="mono text-[10px] text-[#61c997] border border-[#315944] bg-[#12231c] px-2 py-1">BONDING CURVE</div></div></div>
        <div className="grid grid-cols-2"><Metric label="Market cap" value={formatUsd(token.marketCap)}/><Metric label="Volume / 24h" value={formatUsd(token.volume24h)} border/><Metric label="Creator fees" value={`$${token.fees24h.toLocaleString()}`} top/><Metric label="Holders" value={token.holders.toLocaleString()} border top/></div>
      </div>
      <div className="bg-[#0d1013] px-3 sm:px-8"><FeeStream token={token.symbol} pair={token.canonicalPair.symbol} buyAsset={token.buyFeeAsset.symbol} sellAsset={token.sellFeeAsset.symbol}/></div>
    </section>

    <section className="grid lg:grid-cols-[1fr_1fr_.8fr] border-x border-b hairline">
      <SidePanel side="BUY" raw={token.buyFeesRaw} acquired={token.buyAcquired} asset={token.buyFeeAsset.symbol} pending="0.032" threshold="0.050"/>
      <SidePanel side="SELL" raw={token.sellFeesRaw} acquired={token.sellAcquired} asset={token.sellFeeAsset.symbol} pending="0.018" threshold="0.050" border/>
      <div className="p-6 border-t lg:border-t-0 lg:border-l hairline"><div className="eyebrow">Batch status</div><div className="mt-6 flex items-center justify-between"><span className="text-sm">Next route</span><span className="mono text-xs">18:42</span></div><div className="mt-3 h-1 bg-[#20262b]"><div className="h-full w-[64%] bg-[#d18a59]"/></div><div className="mt-3 flex justify-between mono text-[10px] text-[#656e75]"><span>0.032 SOL</span><span>0.050 SOL</span></div><div className="mt-8 flex items-start gap-3 border-t hairline pt-5"><TimerReset size={16} className="mt-0.5 text-[#7fa9c7]"/><p className="text-xs leading-5 text-[#737c83]">Threshold or 30-minute interval, whichever comes first. Failed quotes keep raw SOL in custody.</p></div></div>
    </section>

    <section className="py-14 sm:py-20">
      <div className="flex items-end justify-between border-b hairline pb-5"><div><div className="eyebrow">Public ledger</div><h2 className="mt-3 text-2xl">Fee routing history</h2></div><button className="mono text-[10px] text-[#828b92]">VIEW ALL 24 ↗</button></div>
      <div className="panel mt-5 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left"><thead><tr className="eyebrow border-b hairline">{['Stream','Raw creator fee','Converted into','Status','Age','Transaction'].map(x=><th className="px-4 py-3 font-normal" key={x}>{x}</th>)}</tr></thead><tbody>{history.map((row,i)=><tr key={i} className="border-b last:border-0 hairline mono text-xs"><td className={`px-4 py-4 ${row.side==='BUY'?'text-[#61c997]':'text-[#df6b62]'}`}>{row.side}</td><td className="px-4 py-4">{row.input}</td><td className="px-4 py-4">{row.output}</td><td className="px-4 py-4"><span className="text-[#61c997]">●</span> SETTLED</td><td className="px-4 py-4 text-[#707980]">{row.age}</td><td className="px-4 py-4 text-[#899299]"><span className="inline-flex gap-2">{row.tx}<ExternalLink size={11}/></span></td></tr>)}</tbody></table></div>
    </section>
  </main>;
}

function Metric({ label, value, border, top }: { label: string; value: string; border?: boolean; top?: boolean }) { return <div className={`p-5 ${border?'border-l':''} ${top?'border-t':''} hairline`}><div className="eyebrow">{label}</div><div className="number mt-2 text-xl">{value}</div></div>; }
function SidePanel({ side, raw, acquired, asset, pending, threshold, border }: { side: "BUY"|"SELL"; raw: number; acquired: number; asset: string; pending: string; threshold: string; border?: boolean }) { const buy=side==="BUY"; return <div className={`p-6 ${border?'border-t lg:border-t-0 lg:border-l':''} hairline`}><div className={`eyebrow ${buy?'text-[#61c997]!':'text-[#df6b62]!'}`}>{side} side</div><div className="mt-6 grid grid-cols-2 gap-y-7"><div><span className="eyebrow">Raw fees</span><div className="number mt-2 text-xl">{raw.toFixed(2)} <small className="text-xs text-[#697279]">SOL</small></div></div><div><span className="eyebrow">Acquired</span><div className="number mt-2 text-xl">{acquired.toLocaleString()} <small className="text-xs text-[#697279]">{asset}</small></div></div><div><span className="eyebrow">Pending</span><div className="number mt-2 text-sm">{pending} SOL</div></div><div><span className="eyebrow">Threshold</span><div className="number mt-2 text-sm">{threshold} SOL</div></div></div></div>; }
