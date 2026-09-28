import { ArrowLeft, ArrowRight } from "lucide-react";

export function FeeStream({ token, pair, buyAsset, sellAsset, compact = false }: { token: string; pair: string; buyAsset: string; sellAsset: string; compact?: boolean }) {
  if (compact) return <div className="grid grid-cols-2 border-t hairline">
    <div className="border-r hairline p-3"><div className="eyebrow text-[#61c997]!">Buy fees</div><div className="mt-2 flex items-center gap-2 mono text-xs"><ArrowRight size={12} className="text-[#61c997]"/>{buyAsset}</div></div>
    <div className="p-3"><div className="eyebrow text-[#df6b62]!">Sell fees</div><div className="mt-2 flex items-center gap-2 mono text-xs"><ArrowRight size={12} className="text-[#df6b62]"/>{sellAsset}</div></div>
  </div>;
  return <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-8 py-7">
    <div className="text-right">
      <div className="eyebrow text-[#61c997]!">Buy-generated fees</div>
      <div className="mt-3 flex items-center justify-end gap-3"><strong className="text-xl sm:text-2xl">{buyAsset}</strong><span className="grid h-9 w-9 place-items-center border border-[#315944] bg-[#12231c] text-[#61c997]"><ArrowLeft size={16}/></span></div>
    </div>
    <div className="relative flex min-w-28 flex-col items-center">
      <div className="absolute left-[-24px] right-1/2 top-[52px] h-px bg-[#315944]"/><i className="pulse-left absolute left-[15%] top-[49px] h-1.5 w-1.5 rounded-full bg-[#61c997]"/>
      <div className="absolute left-1/2 right-[-24px] top-[52px] h-px bg-[#633733]"/><i className="pulse-right absolute right-[15%] top-[49px] h-1.5 w-1.5 rounded-full bg-[#df6b62]"/>
      <span className="eyebrow mb-2">{pair} market</span><strong className="relative z-10 border hairline bg-[#0f1216] px-5 py-3 text-xl sm:text-2xl">${token}</strong>
    </div>
    <div>
      <div className="eyebrow text-[#df6b62]!">Sell-generated fees</div>
      <div className="mt-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border border-[#633733] bg-[#251615] text-[#df6b62]"><ArrowRight size={16}/></span><strong className="text-xl sm:text-2xl">{sellAsset}</strong></div>
    </div>
  </div>;
}
