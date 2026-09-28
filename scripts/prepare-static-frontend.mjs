import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "two", "public");
const destination = join(root, "public");
const pages = ["index.html", "launch.html", "explore.html", "docs.html"];
const assets = ["two.png", "favicon.png", "apple-touch-icon.png", "og.png", "two-live.js"];

const liveExploreShell = `<section class="two-explore">
  <div class="two-page-inner">
    <section class="pg-hero">
      <div class="pg-hero-bg" aria-hidden="true"></div>
      <div class="pg-hero-body">
        <div class="pg-hero-head">
          <h1 class="framer-text framer-styles-preset-sqbruw">Explore tokens</h1>
          <a class="two-btn" href="/launch">Launch a token</a>
        </div>
        <p class="framer-text framer-styles-preset-1hdbxly">Every token shown here is verified directly from the TWO program on Solana.</p>
      </div>
    </section>
    <section id="two-live-root" class="two-live" aria-live="polite">
      <div class="two-live-empty">Loading on-chain launches…</div>
    </section>
  </div>
</section>`;

function removeExplorePreviewData(html) {
  const start = html.indexOf('<section class="two-explore">');
  const endMarker = '</script></div><div id="overlay">';
  const end = html.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error("Could not locate Explore preview markup");
  return html.slice(0, start) + liveExploreShell + html.slice(end + "</script>".length);
}

mkdirSync(destination, { recursive: true });
for (const asset of assets) copyFileSync(join(source, asset), join(destination, asset));

for (const page of pages) {
  let html = readFileSync(join(source, page), "utf8");
  if (!html.includes('href="/launch"') || !html.includes('href="/explore"')) {
    throw new Error(`${page} is missing required navbar destinations`);
  }
  html = html
    .replaceAll("https://flowfin.framer.website/", "https://near-jade.vercel.app/")
    .replaceAll("routed through NEAR Protocol", "routed on Solana")
    .replaceAll("Routing through NEAR Intents", "Routing through Jupiter")
    .replaceAll("through NEAR Intents", "through Jupiter")
    .replaceAll("on NEAR Protocol", "on Solana")
    .replaceAll(">NEAR Intents<", ">Jupiter<")
    .replace("</body>", '<script src="/two-nav.js" defer></script></body>');
  if (page === "index.html") {
    html = html.replace("</body>", '<script src="/two-live.js" defer></script></body>');
  }
  if (page === "launch.html") {
    html = html.replace("</body>", '<script src="/launch-client.js" defer></script></body>');
  }
  if (page === "explore.html") {
    html = removeExplorePreviewData(html);
    html = html.replace("</body>", '<script src="/explore-client.js" defer></script></body>');
  }
  writeFileSync(join(destination, page), html, "utf8");
}

await build({
  entryPoints: [join(root, "frontend", "launch-client.ts")],
  outfile: join(destination, "launch-client.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["es2022"],
});

await build({
  entryPoints: [join(root, "frontend", "explore-client.ts")],
  outfile: join(destination, "explore-client.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["es2022"],
});

console.log(`Prepared ${pages.length} TWO pages in ${destination}`);
