import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DirectionalFeeToken } from "@/lib/types";
import { FeeStream } from "./fee-stream";
import { formatUsd } from "@/lib/data";

export function TokenCard({ token }: { token: DirectionalFeeToken }) {
  return <Link href={`/token/${token.mint}`} className="focus-ring group panel block transition-colors hover:border-[#48515a]">
    <div className="flex items-start justify-between p-4">
      <div className="flex gap-3"><div className="grid h-10 w-10 place-items-center bg-[#20252a] mono text-xs">{token.symbol.slice(0, 2)}</div><div><h3 className="text-[15px] font-semibold">${token.symbol}</h3><p className="mt-1 mono text-[10px] text-[#69727a]">{token.symbol} / {token.canonicalPair.symbol}</p></div></div>
      <ArrowUpRight size={15} className="text-[#586169] transition group-hover:text-white"/>
    </div>
    <FeeStream compact token={token.symbol} pair={token.canonicalPair.symbol} buyAsset={token.buyFeeAsset.symbol} sellAsset={token.sellFeeAsset.symbol}/>
    <div className="grid grid-cols-3 border-t hairline px-4 py-3 mono text-[10px]"><div><span className="text-[#626b73]">MC</span><div className="mt-1 text-[#c6c9c7]">{formatUsd(token.marketCap)}</div></div><div><span className="text-[#626b73]">VOL 24H</span><div className="mt-1 text-[#c6c9c7]">{formatUsd(token.volume24h)}</div></div><div className="text-right"><span className="text-[#626b73]">FEES 24H</span><div className="mt-1 text-[#d18a59]">${token.fees24h.toLocaleString()}</div></div></div>
  </Link>;
}
