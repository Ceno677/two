import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { TOKENS, formatUsd } from "@/lib/data";
import { FeeStream } from "@/components/fee-stream";
import { TokenCard } from "@/components/token-card";
import Link from "next/link";

export default function Home() {
  const lead = TOKENS[0];
  return <main>
    <section className="shell grid lg:grid-cols-[.78fr_1.22fr] border-x hairline">
      <div className="border-b lg:border-b-0 lg:border-r hairline p-6 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[430px]">
        <div><div className="eyebrow flex items-center gap-2"><i className="h-px w-6 bg-[#d18a59]"/> Creator revenue, programmed</div><h1 className="mt-7 max-w-[620px] text-[44px] sm:text-[60px] lg:text-[68px] leading-[.9] tracking-[-.055em]">One market.<br/>Two fee<br/><span className="text-[#8d9499]">directions.</span></h1></div>
        <div className="mt-12 flex flex-wrap items-center gap-4"><Link href="/launch" className="focus-ring flex h-11 items-center gap-3 bg-[#e9e9e4] px-5 text-xs font-semibold text-[#090b0e]">Configure a launch <ArrowUpRight size={14}/></Link><span className="mono text-[10px] leading-relaxed text-[#636c73]">TRADES STAY NORMAL<br/>ONLY CREATOR FEES ROUTE</span></div>
      </div>
      <div className="relative min-h-[430px] overflow-hidden bg-[#0d1013] p-5 sm:p-10 flex flex-col justify-center">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage:"linear-gradient(#262c31 1px,transparent 1px),linear-gradient(90deg,#262c31 1px,transparent 1px)",backgroundSize:"48px 48px"}}/>
        <div className="relative panel">
          <div className="flex items-center justify-between border-b hairline px-4 py-3"><span className="eyebrow">Live fee topology</span><span className="mono text-[10px] text-[#61c997]">● INDEXER ONLINE</span></div>
          <FeeStream token={lead.symbol} pair={lead.canonicalPair.symbol} buyAsset={lead.buyFeeAsset.symbol} sellAsset={lead.sellFeeAsset.symbol}/>
          <div className="grid grid-cols-2 border-t hairline"><div className="border-r hairline p-4"><span className="eyebrow">Buy fees generated</span><div className="number mt-2 text-2xl">{lead.buyFeesRaw.toFixed(2)} <small className="text-xs text-[#737b81]">SOL</small></div></div><div className="p-4 text-right"><span className="eyebrow">Sell fees generated</span><div className="number mt-2 text-2xl">{lead.sellFeesRaw.toFixed(2)} <small className="text-xs text-[#737b81]">SOL</small></div></div></div>
        </div>
      </div>
    </section>

    <section className="shell border-x border-b hairline grid grid-cols-2 md:grid-cols-4">
      {[['24H VOLUME','$3.82m'],['CREATOR FEES','$48.1k'],['ROUTED BATCHES','1,248'],['RAW FEES SAFE','100%']].map(([label,value],i)=><div key={label} className={`p-5 sm:p-6 ${i<3?'md:border-r':''} ${i%2===0?'border-r':''} ${i<2?'border-b md:border-b-0':''} hairline`}><div className="eyebrow">{label}</div><div className="number mt-2 text-xl sm:text-2xl">{value}</div></div>)}
    </section>

    <section className="shell py-14 sm:py-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b hairline pb-5"><div><div className="eyebrow">Illustrative markets / 03</div><h2 className="mt-3 text-3xl tracking-[-.035em]">Directional fee configurations</h2><p className="mt-2 text-xs text-[#687178]">Examples only. Deployed tokens will be loaded from the protocol index.</p></div><div className="flex gap-1">{['Trending','Newest','Most fees'].map((x,i)=><button className={`focus-ring border hairline px-3 py-2 mono text-[10px] ${i===0?'bg-[#e9e9e4] text-[#090b0e]':'text-[#7b848b]'}`} key={x}>{x}</button>)}</div></div>
      <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">{TOKENS.map(token=><TokenCard token={token} key={token.mint}/>)}</div>
    </section>

    <section className="shell border hairline grid md:grid-cols-3 bg-[#0d1013]">
      <div className="p-7 md:border-r hairline"><ShieldCheck size={20} strokeWidth={1.4}/><h3 className="mt-10 text-lg">Trade output untouched</h3><p className="mt-3 text-sm leading-6 text-[#7d858c]">Buyers receive tokens. Sellers receive normal pair proceeds. Directional routing applies only to creator fees.</p></div>
      <div className="p-7 border-t md:border-t-0 md:border-r hairline"><ArrowDown size={20} strokeWidth={1.4}/><h3 className="mt-10 text-lg">Finalized before routing</h3><p className="mt-3 text-sm leading-6 text-[#7d858c]">Events are classified from Pump program data and batched only after Solana finality.</p></div>
      <div className="p-7 border-t md:border-t-0 hairline"><div className="mono text-lg text-[#d18a59]">Σ</div><h3 className="mt-10 text-lg">Raw funds remain safe</h3><p className="mt-3 text-sm leading-6 text-[#7d858c]">A missing or failed route becomes retryable. It never silently substitutes an asset or discards accrued fees.</p></div>
    </section>
  </main>;
}
