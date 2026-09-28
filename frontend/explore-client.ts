type Launch = {
  mint: string;
  canonicalPairMint: string;
  buyFeeAssetMint: string;
  sellFeeAssetMint: string;
  buyRoutedRaw: string;
  sellRoutedRaw: string;
  enabled: boolean;
  paused: boolean;
};

type Asset = { mint: string; symbol: string | null };

function short(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .two-live{padding:36px;border:1px solid #00000014;border-radius:28px;background:#f8f8f8;color:#000;font-family:Inter,Arial,sans-serif}.two-live-inner{width:100%}.two-live-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}.two-live-head span{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.14em}.two-live-head span i{width:7px;height:7px;border-radius:50%;background:#3ccf65;box-shadow:0 0 0 4px #3ccf6520}.two-live-head h2{font-size:clamp(30px,5vw,56px);line-height:1;margin-top:10px}.two-live-head a{color:#000;text-decoration:none;font-weight:600}.two-live-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.two-live-card,.two-live-empty{background:#fff;border:1px solid #00000018;border-radius:14px;padding:20px;text-decoration:none;color:#000}.two-live-card{display:grid;gap:16px;transition:transform .15s ease}.two-live-card:hover{transform:translateY(-2px)}.two-live-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px}.two-live-empty strong{font-size:18px}.two-live-empty span{max-width:390px;color:#666;line-height:1.5}.two-live-empty a{margin-top:8px;padding:10px 15px;border-radius:9px;background:#000;color:#fff;text-decoration:none;font-weight:600}.two-live-token{display:flex;justify-content:space-between}.two-live-token span{color:#666}.two-live-route{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #00000012;padding-top:12px}.two-live-route span{font-size:11px;font-weight:700}.two-live-route .buy{color:#267a33}.two-live-route .sell{color:#b42318}@media(max-width:600px){.two-live{padding:22px}.two-live-head{display:block}.two-live-head a{display:inline-block;margin-top:18px}}
  `;
  document.head.appendChild(style);
}

async function setupExplore() {
  const root = document.querySelector<HTMLElement>("#two-live-root");
  if (!root) return;
  addStyles();

  try {
    const [activityResponse, assetsResponse] = await Promise.all([fetch("/api/activity"), fetch("/api/assets")]);
    if (!activityResponse.ok || !assetsResponse.ok) throw new Error("Live launch data is unavailable");
    const activity = await activityResponse.json() as { launches?: Launch[] };
    const assets = await assetsResponse.json() as { assets?: Asset[] };
    const labels = new Map((assets.assets ?? []).map((asset) => [asset.mint, asset.symbol ?? short(asset.mint)]));
    const launches = activity.launches ?? [];

    root.innerHTML = `
      <div class="two-live-inner">
        <div class="two-live-head"><div><span><i aria-hidden="true"></i> LIVE ON SOLANA</span><h2>Community launches</h2></div><a href="/launch">Launch a token →</a></div>
        <div class="two-live-grid"></div>
      </div>`;
    const grid = root.querySelector<HTMLElement>(".two-live-grid");
    if (!grid) return;

    if (launches.length === 0) {
      grid.innerHTML = '<div class="two-live-empty"><strong>No launches yet</strong><span>The first token launched through TWO will appear here automatically.</span><a href="/launch">Launch the first token</a></div>';
      return;
    }

    for (const launch of launches) {
      const card = document.createElement("a");
      card.className = "two-live-card";
      card.href = `https://pump.fun/coin/${launch.mint}`;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.innerHTML = `
        <div class="two-live-token"><strong>${short(launch.mint)}</strong><span>${labels.get(launch.canonicalPairMint) ?? short(launch.canonicalPairMint)} pair</span></div>
        <div class="two-live-route"><span class="buy">BUY FEES</span><b>→ ${labels.get(launch.buyFeeAssetMint) ?? short(launch.buyFeeAssetMint)}</b></div>
        <div class="two-live-route"><span class="sell">SELL FEES</span><b>→ ${labels.get(launch.sellFeeAssetMint) ?? short(launch.sellFeeAssetMint)}</b></div>
      `;
      grid.appendChild(card);
    }
  } catch {
    root.innerHTML = '<div class="two-live-empty"><strong>Launches could not be loaded</strong><span>Refresh the page to try the Solana connection again.</span></div>';
  }
}

void setupExplore();
