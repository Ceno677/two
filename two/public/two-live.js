(() => {
  // Home hero only: tiny live pill — "NEAR protocols processing pairs — LIVE".
  var path = window.location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
  if (path !== "/" && path !== "/index") return;

  var PAIRS = [
    "SOL / USDC",
    "BTC / USDC",
    "ETH / SOL",
    "NEAR / USDC",
    "ZEC / XMR",
    "BTC / ETH",
  ];

  var style = document.createElement("style");
  style.textContent = [
    ".two-live{display:flex;justify-content:center;width:100%;margin:14px 0 18px;position:relative;z-index:5}",
    ".two-live-pill{display:inline-flex;align-items:center;gap:9px;padding:8px 15px;border-radius:999px;",
    "background:rgba(255,255,255,.82);border:1px solid rgba(0,0,0,.09);backdrop-filter:blur(8px);",
    "font-family:Inter,sans-serif;font-size:12.5px;font-weight:500;color:#000;box-shadow:0 4px 18px rgba(0,0,0,.07)}",
    ".two-live-dot{width:8px;height:8px;border-radius:50%;background:#16a34a;flex:none;position:relative}",
    ".two-live-dot::after{content:'';position:absolute;inset:-4px;border-radius:50%;",
    "border:2px solid #16a34a;opacity:.55;animation:two-ping 1.6s ease-out infinite}",
    "@keyframes two-ping{0%{transform:scale(.5);opacity:.7}100%{transform:scale(1.15);opacity:0}}",
    ".two-live-tag{font-weight:700;font-size:10.5px;letter-spacing:.07em;color:#fff;background:#16a34a;",
    "padding:3px 7px;border-radius:6px}",
    ".two-live-pair{font-weight:600;color:#000}",
    "@media(max-width:809.98px){.two-live{margin:10px 0 14px}.two-live-pill{font-size:11.5px;padding:7px 12px}}",
  ].join("\n");
  document.head.appendChild(style);

  function mount(attempts) {
    // Hero title block exists in all 3 responsive variants; use the visible one.
    var blocks = Array.prototype.slice.call(
      document.querySelectorAll('[data-framer-name="Title Block"]')
    );
    var target = null;
    for (var i = 0; i < blocks.length; i++) {
      var r = blocks[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { target = blocks[i]; break; }
    }
    if (!target) {
      if (attempts < 40) setTimeout(function () { mount(attempts + 1); }, 250);
      return;
    }
    if (target.querySelector(":scope > .two-live")) return;

    var wrap = document.createElement("div");
    wrap.className = "two-live";
    wrap.innerHTML =
      '<span class="two-live-pill"><span class="two-live-dot" aria-hidden="true"></span>' +
      "<span>NEAR protocols processing pairs&nbsp;·&nbsp;<span class=\"two-live-pair\"></span></span>" +
      '<span class="two-live-tag">LIVE</span></span>';
    target.insertBefore(wrap, target.firstChild);

    var pairEl = wrap.querySelector(".two-live-pair");
    var idx = 0;
    function tick() {
      pairEl.textContent = PAIRS[idx % PAIRS.length];
      idx++;
    }
    tick();
    setInterval(tick, 2600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(0); });
  } else {
    mount(0);
  }
})();
