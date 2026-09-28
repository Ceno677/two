import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Hexagon } from "lucide-react";
import { SolanaProvider } from "@/components/solana-provider";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = { title: "Directional Fees", description: "Programmable creator revenue on Pump.fun" };

function Header() {
  return <header className="border-b hairline bg-[#090b0ef5] sticky top-0 z-50 backdrop-blur-md">
    <div className="shell h-16 flex items-center justify-between">
      <Link href="/" className="focus-ring flex items-center gap-3" aria-label="Directional Fees home">
        <span className="grid h-8 w-8 place-items-center border hairline bg-[#12161a]"><Hexagon size={15} strokeWidth={1.5}/></span>
        <span className="text-[15px] tracking-[.02em]">DIRECTIONAL <span className="text-[#808890]">/ FEES</span></span>
      </Link>
      <nav className="hidden md:flex items-center gap-7 text-[13px] text-[#929aa1]">
        <Link className="hover:text-white" href="/">Markets</Link>
        <Link className="hover:text-white" href="/dashboard">Dashboard</Link>
        <Link className="hover:text-white" href="/docs">Protocol</Link>
      </nav>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-2 mono text-[10px] text-[#7f888f]"><i className="h-1.5 w-1.5 rounded-full bg-[#61c997]"/> MAINNET</span>
        <Link href="/launch" className="focus-ring flex h-9 items-center gap-2 bg-[#e9e9e4] px-4 text-[12px] font-semibold text-[#090b0e] hover:bg-white">Launch token <ArrowUpRight size={14}/></Link>
      </div>
    </div>
  </header>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SolanaProvider><Header/>{children}<footer className="shell mt-20 border-t hairline py-8 flex flex-col sm:flex-row gap-4 justify-between mono text-[10px] text-[#59626a]"><span>DIRECTIONAL FEES / ONCHAIN CREATOR REVENUE</span><span>TRADERS TRADE NORMALLY. ONLY CREATOR FEES ARE ROUTED.</span></footer></SolanaProvider></body></html>;
}
