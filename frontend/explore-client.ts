type Launch = {
  mint: string;
  canonicalPairMint: string;
  buyFeeAssetMint: string;
  sellFeeAssetMint: string;
  buyRoutedRaw: string;
  sellRoutedRaw: string;
  enabled: boolean;
  paused: boolean;
  symbol?: string | null;
  pairSymbol?: string | null;
  buySymbol?: string | null;
  sellSymbol?: string | null;
};

type Asset = { mint: string; symbol: string | null };

type LocalLaunch = {
  mint: string;
  symbol: string;
  pairSymbol: string;
  buySymbol: string;
  sellSymbol: string;
};

const LAST_LAUNCH_KEY = "two:last-launch";
const LAUNCHES_KEY = "two:launches";
const PENDING_REGISTRATION_KEY = "two:pending-registration";

function short(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function isLocalLaunch(value: unknown): value is LocalLaunch {
  if (!value || typeof value !== "object") return false;
  const launch = value as Partial<LocalLaunch>;
  return typeof launch.mint === "string" && typeof launch.symbol === "string"
    && typeof launch.pairSymbol === "string" && typeof launch.buySymbol === "string" && typeof launch.sellSymbol === "string";
}

function readLocalLaunches(): LocalLaunch[] {
  try {
    const launches = JSON.parse(localStorage.getItem(LAUNCHES_KEY) ?? "[]") as unknown;
    const valid = Array.isArray(launches) ? launches.filter(isLocalLaunch) : [];
    const legacy = JSON.parse(localStorage.getItem(LAST_LAUNCH_KEY) ?? "null") as unknown;
    if (isLocalLaunch(legacy) && !valid.some((launch) => launch.mint === legacy.mint)) valid.unshift(legacy);
    return valid;
  } catch {
    return [];
  }
}

async function retryPendingRegistration() {
  const pending = localStorage.getItem(PENDING_REGISTRATION_KEY);
  if (!pending) return;
  try {
    const response = await fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: pending,
    });
    if (response.ok) localStorage.removeItem(PENDING_REGISTRATION_KEY);
  } catch {
    // The local launch remains visible and the registration can retry later.
  }
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .two-live{padding:36px;border:1px solid #00000014;border-radius:28px;background:#f8f8f8;color:#000;font-family:Inter,Arial,sans-serif}.two-live-inner{width:100%}.two-live-banner{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:space-between;padding:22px 26px;border-radius:20px;margin-bottom:28px;color:#fff;background:linear-gradient(120deg,#0b3d2e 0%,#14532d 55%,#16a34a 130%);box-shadow:0 12px 32px rgba(20,83,45,.25)}.two-live-banner-main{display:flex;align-items:center;gap:14px;min-width:0}.two-live-pulse{width:12px;height:12px;border-radius:50%;background:#4ade80;flex:none;position:relative}.two-live-pulse::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:2px solid #4ade80;opacity:.6;animation:two-ping 1.6s ease-out infinite}@keyframes two-ping{0%{transform:scale(.5);opacity:.7}100%{transform:scale(1.15);opacity:0}}.two-live-banner-title{font-size:clamp(19px,3vw,27px);font-weight:700;line-height:1.15}.two-live-banner-sub{font-size:13px;opacity:.85;margin-top:3px}.two-live-banner-sub b{color:#bbf7d0}.two-live-banner-tag{font-size:11px;font-weight:800;letter-spacing:.1em;padding:6px 12px;border-radius:8px;background:#4ade80;color:#052e16;flex:none}.two-live-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}.two-live-head span{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.14em}.two-live-head span i{width:7px;height:7px;border-radius:50%;background:#3ccf65;box-shadow:0 0 0 4px #3ccf6520}.two-live-head h2{font-size:clamp(30px,5vw,56px);line-height:1;margin-top:10px}.two-live-head a{color:#000;text-decoration:none;font-weight:600}.two-live-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.two-live-card,.two-live-empty{background:#fff;border:1px solid #00000018;border-radius:14px;padding:20px;text-decoration:none;color:#000}.two-live-card{display:grid;gap:16px;transition:transform .15s ease}.two-live-card:hover{transform:translateY(-2px)}.two-live-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px}.two-live-empty strong{font-size:18px}.two-live-empty span{max-width:390px;color:#666;line-height:1.5}.two-live-empty a{margin-top:8px;padding:10px 15px;border-radius:9px;background:#000;color:#fff;text-decoration:none;font-weight:600}.two-live-token{display:flex;justify-content:space-between;gap:12px}.two-live-token span{color:#666;text-align:right}.two-live-route{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #00000012;padding-top:12px}.two-live-route span{font-size:11px;font-weight:700}.two-live-route .buy{color:#267a33}.two-live-route .sell{color:#b42318}.two-live-verified{font-size:10px!important;letter-spacing:.08em;color:#267a33!important;text-transform:uppercase}@media(max-width:600px){.two-live{padding:22px}.two-live-head{display:block}.two-live-head a{display:inline-block;margin-top:18px}}
  `;
  document.head.appendChild(style);
}

function appendLocalCard(grid: HTMLElement, launch: LocalLaunch) {
  const card = document.createElement("a");
  card.className = "two-live-card";
  card.href = `https://pump.fun/coin/${encodeURIComponent(launch.mint)}`;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.innerHTML = `
    <div class="two-live-token"><strong>$${escapeHtml(launch.symbol)}</strong><span>${escapeHtml(launch.pairSymbol)} pair<br><em class="two-live-verified">confirmed launch</em></span></div>
    <div class="two-live-route"><span class="buy">BUY FEES</span><b>→ ${escapeHtml(launch.buySymbol)}</b></div>
    <div class="two-live-route"><span class="sell">SELL FEES</span><b>→ ${escapeHtml(launch.sellSymbol)}</b></div>
  `;
  grid.appendChild(card);
}

function startPairRotation(root: HTMLElement, launches: Launch[]) {
  const pairEl = root.querySelector<HTMLElement>(".two-live-banner-pair");
  if (!pairEl) return;
  const names = launches.map((launch) =>
    launch.symbol ? `$${launch.symbol}` : short(launch.mint));
  if (names.length === 0) {
    pairEl.textContent = "new pairs";
    return;
  }
  let idx = 0;
  const tick = () => {
    pairEl.textContent = names[idx % names.length];
    idx++;
  };
  tick();
  window.setInterval(tick, 2600);
}

async function setupExplore() {
  const root = document.querySelector<HTMLElement>("#two-live-root");
  if (!root) return;
  addStyles();
  const localLaunches = readLocalLaunches();
  await retryPendingRegistration();

  try {
    const [activityResponse, assetsResponse] = await Promise.all([fetch("/api/activity"), fetch("/api/assets")]);
    if (!activityResponse.ok || !assetsResponse.ok) throw new Error("Live launch data is unavailable");
    const activity = await activityResponse.json() as { launches?: Launch[] };
    const assets = await assetsResponse.json() as { assets?: Asset[] };
    const labels = new Map((assets.assets ?? []).map((asset) => [asset.mint, asset.symbol ?? short(asset.mint)]));
    const launches = activity.launches ?? [];

    root.innerHTML = `
      <div class="two-live-inner">
        <div class="two-live-banner"><div class="two-live-banner-main"><span class="two-live-pulse" aria-hidden="true"></span><div><div class="two-live-banner-title">NEAR protocols processing pairs</div><div class="two-live-banner-sub">Routing <b class="two-live-banner-pair"></b> right now · <b>${launches.length} live</b></div></div></div><span class="two-live-banner-tag">LIVE</span></div>
        <div class="two-live-head"><div><span><i aria-hidden="true"></i> LIVE ON SOLANA</span><h2>Community launches</h2></div><a href="/launch">Launch a token →</a></div>
        <div class="two-live-grid"></div>
      </div>`;
    const grid = root.querySelector<HTMLElement>(".two-live-grid");
    if (!grid) return;
    startPairRotation(root, launches);

    const publicMints = new Set(launches.map((launch) => launch.mint));
    const localOnlyLaunches = localLaunches.filter((launch) => !publicMints.has(launch.mint));
    if (launches.length === 0 && localOnlyLaunches.length === 0) {
      root.innerHTML = '<div class="two-live-inner"><div class="two-live-banner"><div class="two-live-banner-main"><span class="two-live-pulse" aria-hidden="true"></span><div><div class="two-live-banner-title">NEAR protocols processing pairs</div><div class="two-live-banner-sub">Waiting for the first launch</div></div></div><span class="two-live-banner-tag">LIVE</span></div><div class="two-live-grid"></div></div>';
      const emptyGrid = root.querySelector<HTMLElement>(".two-live-grid");
      if (emptyGrid) emptyGrid.innerHTML = '<div class="two-live-empty"><strong>No launches yet</strong><span>The first token launched through TWO will appear here automatically.</span><a href="/launch">Launch the first token</a></div>';
      return;
    }

    for (const launch of localOnlyLaunches) appendLocalCard(grid, launch);

    for (const launch of launches) {
      const card = document.createElement("a");
      card.className = "two-live-card";
      card.href = `https://pump.fun/coin/${encodeURIComponent(launch.mint)}`;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.innerHTML = `
        <div class="two-live-token"><strong>${launch.symbol ? `$${escapeHtml(launch.symbol)}` : short(launch.mint)}</strong><span>${escapeHtml(launch.pairSymbol ?? labels.get(launch.canonicalPairMint) ?? short(launch.canonicalPairMint))} pair</span></div>
        <div class="two-live-route"><span class="buy">BUY FEES</span><b>→ ${escapeHtml(launch.buySymbol ?? labels.get(launch.buyFeeAssetMint) ?? short(launch.buyFeeAssetMint))}</b></div>
        <div class="two-live-route"><span class="sell">SELL FEES</span><b>→ ${escapeHtml(launch.sellSymbol ?? labels.get(launch.sellFeeAssetMint) ?? short(launch.sellFeeAssetMint))}</b></div>
      `;
      grid.appendChild(card);
    }
  } catch {
    if (localLaunches.length > 0) {
      root.innerHTML = '<div class="two-live-grid"></div>';
      const grid = root.querySelector<HTMLElement>(".two-live-grid");
      if (grid) for (const launch of localLaunches) appendLocalCard(grid, launch);
      return;
    }
    root.innerHTML = '<div class="two-live-empty"><strong>Launches could not be loaded</strong><span>Refresh the page to try the Solana connection again.</span></div>';
  }
}

void setupExplore();
