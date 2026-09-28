import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "two", "public");
const destination = join(root, "public");
const pages = ["index.html", "launch.html", "explore.html", "docs.html"];
const assets = ["two.png", "favicon.png", "apple-touch-icon.png", "og.png"];

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
    .replace("</body>", '<script src="/two-nav.js" defer></script></body>');
  if (page === "launch.html") {
    html = html.replace("</body>", '<script src="/launch-client.js" defer></script></body>');
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

console.log(`Prepared ${pages.length} TWO pages in ${destination}`);
