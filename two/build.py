#!/usr/bin/env python3
"""Extrait la hero page (nav + Hero Section) du template Framer Flowfin
et produit public/index.html : HTML statique, sans hydratation React."""
import os, re

SRC = "/Users/adam/Documents/Flowfin - SaaS Framer Template.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public", "index.html")

s = open(SRC, encoding="utf-8").read()

def cut(html, start, end, label):
    """Supprime html[start .. end[ — le marqueur `end` est conserve."""
    i = html.find(start)
    j = html.find(end, i + 1) if i != -1 else -1
    if i == -1 or j == -1:
        raise SystemExit("marqueur introuvable: " + label)
    return html[:i] + html[j:]

# 1. toutes les sections apres le hero (Brands, Feature, ... Blog)
s = cut(s, '<section class="framer-krdvqc" data-framer-name="Brands Section">',
           '</div><div id="overlay"></div>', "sections")

# 2. le footer (3 variantes : desktop / phone / tablet)
s = cut(s, '<div class="framer-51udp2-container">',
           '<div class="framer-1izo0p-container">', "footer")

# 3. badge "Made in Framer"
s = cut(s, '<div id="__framer-badge-container">', '<script>var animator=', "badge")

# 4. tracking events.framer.com
s = cut(s, '<script async src="https://events.framer.com/script',
           '<!-- Start of bodyStart -->', "events")

# 5. bundle React + handover data : sans eux la page reste le HTML statique
#    du hero (sinon React re-render la page complete et remet les sections).
#    Les scripts d'appear animations, eux, sont conserves.
s = cut(s, '<link rel="modulepreload" fetchpriority="low"',
           '<div id="svg-templates"', "bundle")

# 6. les 3 variantes responsive partagent le meme data-framer-appear-id ; le
#    script Framer n'anime que le premier match (querySelector), donc sans
#    hydratation la variante mobile restait a opacity:0.001. -> querySelectorAll
old = ("(m,p,d)=>{let t=document.querySelector(m);if(t)"
       "for(let[r,f]of Object.entries(p))"
       "animator.startOptimizedAppearAnimation(t,r,f,d[r])}")
new = ("(m,p,d)=>{document.querySelectorAll(m).forEach(t=>{"
       "for(let[r,f]of Object.entries(p))"
       "animator.startOptimizedAppearAnimation(t,r,f,d[r])})}")
if old not in s:
    raise SystemExit("patch appear: motif introuvable")
s = s.replace(old, new)

# filet de securite : si l'animator ne demarre pas, on revele quand meme
s = s.replace("</body>", """<script>
setTimeout(function(){
  document.querySelectorAll("[data-framer-appear-id]").forEach(function(el){
    if (parseFloat(getComputedStyle(el).opacity) < 0.5) {
      el.style.opacity = "1"; el.style.transform = "none";
    }
  });
}, 2500);
</script>
</body>""")

# 7. spacer flex (flex-grow:1) qui servait a pousser le footer en bas de page :
#    orphelin sans footer, il inserait ~550px de vide avant le hero.
s = s.replace('<div class="framer-185s0lj"></div>', '', 1)

# 8. image du hero (dashboard + photo) retiree
s = cut(s, '<div class="ssr-variant"><div class="framer-19ceisx" data-framer-name="Hero Image"',
           '</div></div></section></div><div id="overlay">', "hero image")

# 9. sans l'image, le hero ne faisait plus que ~720px : le fond vert (dimensionne
#    a 62% de la section) s'arretait a mi-hauteur et il restait du blanc sous la
#    section (min-height:100vh de la racine). On fait remplir l'ecran au hero.
s = s.replace("</body>", """<style>
  /* hero seul : la section remplit l'ecran et le fond vert la couvre entierement */
  .framer-qcsue .framer-1vnnloy { min-height: 100vh; min-height: 100svh; }
  .framer-qcsue .framer-mrvw7p { height: 100% !important; max-height: none !important; }
</style>
</body>""")

# 10. badge "Join Flowfin for Early Access" (avatars + texte) retire
s = cut(s, '<div class="framer-us4lj2"',
           '<div class="framer-v8q4ym" data-framer-name="Title Block">', "badge hero")

# 11. logo : le lockup Flowfin (une seule image mark+wordmark) est remplace par
#     two.png + le nom "two", dans les 3 variantes de navbar.
logo_old_start = '<div class="framer-1q47hoy" data-framer-name="Logo">'
logo_new = ('<div class="framer-1q47hoy two-logo" data-framer-name="Logo">'
            '<img src="/two.png" alt="two logo"><span class="two-name">two</span></div>')
parts = s.split(logo_old_start)
if len(parts) != 4:
    raise SystemExit("logo: %d occurrences au lieu de 3" % (len(parts) - 1))
rebuilt = parts[0]
for chunk in parts[1:]:
    end = chunk.index('object-fit:contain"></div></div>') + len('object-fit:contain"></div></div>')
    rebuilt += logo_new + chunk[end:]
s = rebuilt

# 12. identite : titre, favicon, meta
TITLE = "TWO \u2014 One Token. Two Assets."
DESC = ("Launch tokens with two programmable reserves. Buys build one side, "
        "sells build the other. Powered by NEAR Protocol.")
s = re.sub(r'<title>[^<]*</title>', '<title>%s</title>' % TITLE, s)
s = re.sub(r'<meta name="description" content="[^"]*">',
           '<meta name="description" content="%s">' % DESC, s)
s = re.sub(r'<meta (property="og:|name="twitter:)(title|description)" content="[^"]*">',
           lambda m: '<meta %s%s" content="%s">' % (m.group(1), m.group(2),
                     TITLE if m.group(2) == "title" else DESC), s)
s = re.sub(r'<meta (property="og:image"|name="twitter:image") content="[^"]*">',
           lambda m: '<meta %s content="/og.png">' % m.group(1), s)
s = re.sub(r'<meta name="framer-search-index(-fallback)?" content="[^"]*">\s*', '', s)
s = re.sub(r'<link href="[^"]*" rel="icon"[^>]*>\s*', '', s)
s = s.replace('</head>',
    '<link rel="icon" type="image/png" href="/favicon.png">\n'
    '    <link rel="apple-touch-icon" href="/apple-touch-icon.png">\n</head>')

# 13. styles du lockup two
s = s.replace("</style>\n</body>", """
  /* logo two : mark + nom, a la place du lockup Flowfin */
  a.framer-1isl97g { width: auto !important; }
  .two-logo { position: static !important; display: flex; align-items: center;
              gap: 9px; width: auto !important; height: 100% !important; }
  .two-logo img { height: 100%; width: auto; display: block; }
  .two-name { font-family: "Delight Bold", "Inter", sans-serif; font-weight: 700;
              font-size: 26px; line-height: 1; letter-spacing: -0.02em;
              color: #000; white-space: nowrap; }
</style>
</body>""")

# 14. copy TWO (texte uniquement, la structure Framer est inchangee)
COPY = [
    ("Financial Control That Grows With You", "One token. Two assets."),
    ("Scalable finance tools that automatically adapt to your business needs, "
     "seamlessly supporting your journey from startup to enterprise growth and beyond.",
     "Launch tokens with two programmable reserves. Buys build one side. "
     "Sells build the other. Powered by NEAR Protocol."),
    ("Get Started for Free", "Launch a Token"),
    ("Get Started Now", "Launch a Token"),
    ("No credit card required", "Launches on Pump.fun. Routing through NEAR Intents."),
]
for old, new in COPY:
    if old not in s:
        raise SystemExit("copy: texte introuvable -> " + old[:40])
    s = s.replace(old, new)

# 15. navigation : Launchpad / Explore / Docs / X (l'entree en trop est retiree,
#     les <li> Framer sont conserves tels quels, seuls label et href changent).
NAV = {
    "Home":    ("Launchpad", "/launch", False),
    "About":   ("Explore", "/explore", False),
    "Pricing": ("Docs", "/docs", False),
    "Blog":    ("X", "https://x.com/twopairpad", True),
    "Careers": None,
}

def rewrite_nav(html, docs_href="/docs"):
    def one(m):
        li = m.group(0)
        label = re.search(r">([^<>]+)</p>", li)
        if not label:
            return li
        label = label.group(1)
        if label not in NAV:
            return li
        entry = NAV[label]
        if entry is None:          # "Careers" : une entree de trop
            return ""
        new_label, href, blank = entry
        if new_label == "Docs":
            href = docs_href
        li = li.replace(">%s</p>" % label, ">%s</p>" % new_label)
        li = re.sub(r'href="[^"]*"', 'href="%s"' % href, li, count=1)
        if blank:
            li = li.replace('href="%s"' % href,
                            'href="%s" target="_blank" rel="noopener noreferrer"' % href, 1)
        return li
    return re.sub(r'<li\b[^>]*data-framer-name="Menu Item Wrap"[^>]*>.*?</li>',
                  one, html, flags=re.S)

s = rewrite_nav(s)
for dead in ("Home", "About", "Pricing", "Blog", "Careers"):
    if ">%s</p>" % dead in s:
        raise SystemExit("nav: label residuel -> " + dead)

# liens de nav : ce site n'a que la home
s = re.sub(r'href="\./(about|pricing|blog|career|contact)"', 'href="#"', s)

# ------------------------------------------------------------ CTA -> /launch
# Tous les boutons "Launch a Token" (navbar + hero, 5 variantes responsive)
# pointaient sur "#". On les redirige vers la page de lancement.
def point_ctas(html, label="Launch a Token", href="/launch"):
    out, pos = [], 0
    while True:
        i = html.find(label, pos)
        if i == -1:
            out.append(html[pos:])
            return "".join(out)
        a = html.rfind("<a ", pos, i)
        if a == -1:
            out.append(html[pos:i + len(label)])
            pos = i + len(label)
            continue
        end = html.find(">", a)
        tag = html[a:end]
        out.append(html[pos:a])
        out.append(re.sub(r'href="[^"]*"', 'href="%s"' % href, tag, count=1))
        out.append(html[end:i + len(label)])
        pos = i + len(label)


s = point_ctas(s)

# 16. live pill hero (public/two-live.js) : bandeau "NEAR protocols
#     processing pairs — LIVE" injecte au-dessus du Title Block par JS.
s = s.replace('<script src="/two-nav.js" defer></script>',
              '<script src="/two-nav.js" defer></script><script src="/two-live.js" defer></script>')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(s)
print("ecrit %s (%d octets)" % (OUT, len(s)))

# ---- assets : logo + favicons generes depuis ~/Documents/two.png ----
from PIL import Image, ImageDraw

LOGO_SRC = "/Users/adam/Documents/two.png"
PUB = os.path.dirname(OUT)
GREEN = (157, 250, 127, 255)

mark = Image.open(LOGO_SRC).convert("RGBA")
mark.save(os.path.join(PUB, "two.png"))

def icon(size, radius_ratio=0.22, pad_ratio=0.22):
    """Carre vert arrondi + la marque noire centree."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1],
                        radius=int(size * radius_ratio), fill=GREEN)
    box = int(size * (1 - 2 * pad_ratio))
    w, h = mark.size
    scale = box / max(w, h)
    m = mark.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    img.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return img

icon(512).save(os.path.join(PUB, "favicon.png"))
icon(180, pad_ratio=0.18).save(os.path.join(PUB, "apple-touch-icon.png"))

og = Image.new("RGBA", (1200, 630), GREEN)
w, h = mark.size
scale = 300 / h
m = mark.resize((int(w * scale), 300), Image.LANCZOS)
og.alpha_composite(m, ((1200 - m.width) // 2, (630 - m.height) // 2))
og.convert("RGB").save(os.path.join(PUB, "og.png"))

print("assets: two.png, favicon.png, apple-touch-icon.png, og.png")

# ---------------------------------------------------------------- page /docs
# Derivee de la home : meme <head>, meme navbar, meme typo (presets Framer).
# Seule la section hero est remplacee par le contenu de la doc.

DOCS_TITLE = "Docs — TWO"
DOCS_DESC = ("How TWO works: a programmable dual-reserve layer for token launches on "
             "Pump.fun, with NEAR Protocol as the chain-abstraction infrastructure.")

STEPS = [
    ("Launch",
     "Launch your token through TWO using Pump.fun as the trading and distribution layer."),
    ("Choose Two Sides",
     "Select the reserve asset for buy-side activity and the reserve asset for sell-side activity."),
    ("Trade",
     "The token trades normally while TWO identifies the corresponding side of eligible market activity."),
    ("Route",
     "Using NEAR Protocol infrastructure, TWO routes eligible reserve value toward the selected supported assets."),
    ("Build",
     "Every side of the market contributes to a different reserve. One token, two sides."),
]

NEAR_FEATURES = [
    ("Chain Abstraction", "Cross-chain routing through NEAR infrastructure."),
    ("NEAR Intents", "Intent-based execution for supported assets and networks."),
    ("Built for Solana markets",
     "Tokens can launch and trade on Pump.fun while TWO manages reserve logic "
     "through its infrastructure layer."),
]

TOKENS = [
    ("$ELON", "SpaceX*", "Tesla*"),
    ("$MACRO", "BTC", "USDC"),
    ("$CHAIN", "SOL", "ETH"),
    ("$PRIVACY", "ZEC", "XMR*"),
]

H2 = 'class="framer-text framer-styles-preset-sqbruw"'
H3 = 'class="framer-text framer-styles-preset-1eqcm1y"'
BODY = 'class="framer-text framer-styles-preset-1hdbxly"'
SMALL = 'class="framer-text framer-styles-preset-1hy5wa5"'


def docs_body():
    out = []
    w = out.append
    w('<section class="two-docs"><div class="two-docs-inner">')

    w('<header class="two-doc-head">')
    w('<p class="framer-text framer-styles-preset-1hy5wa5 two-eyebrow">Documentation</p>')
    w('<h1 class="framer-text framer-styles-preset-za4atd">Docs</h1>')
    w('<p %s>TWO adds a programmable dual-reserve layer to token launches. Creators '
      'choose what buy-side activity builds and what sell-side activity builds, while '
      'NEAR Protocol provides the underlying chain-abstraction infrastructure for '
      'supported cross-chain routing.</p>' % BODY)
    w('</header>')

    w('<article class="two-block" id="how-it-works">')
    w('<h2 %s>How it works</h2>' % H2)
    w('<ol class="two-steps">')
    for i, (title, text) in enumerate(STEPS, 1):
        w('<li><span class="two-step-n">%d</span><div><h3 %s>%s</h3><p %s>%s</p></div></li>'
          % (i, H3, title, BODY, text))
    w('</ol></article>')

    w('<article class="two-block" id="example">')
    w('<h2 %s>One market. Two directions.</h2>' % H2)
    w('<p %s>Imagine $ELON launching on Pump.fun through TWO. Its buy side is configured '
      'to build SpaceX exposure, while its sell side is configured to build Tesla '
      'exposure.</p>' % BODY)
    w('<div class="two-sides">')
    w('<div class="two-side"><span class="two-tag two-tag-buy">BUY</span>'
      '<span class="two-arrow">→</span><span class="two-side-label">SpaceX exposure</span></div>')
    w('<div class="two-side"><span class="two-tag two-tag-sell">SELL</span>'
      '<span class="two-arrow">→</span><span class="two-side-label">Tesla exposure</span></div>')
    w('</div>')
    w('<p %s>Users still trade $ELON normally. The difference exists at the treasury '
      'layer: eligible buy-side activity contributes toward one reserve, while eligible '
      'sell-side activity contributes toward the other.</p>' % BODY)
    w('<p class="framer-text framer-styles-preset-1hy5wa5 two-note">The $ELON example illustrates the TWO primitive. Real-world '
      'assets such as Tesla or SpaceX require appropriate tokenized representations, '
      'custody and regulatory infrastructure before they can be used as actual '
      'reserves.</p>')
    w('</article>')

    w('<article class="two-block" id="near">')
    w('<h2 %s>Powered by NEAR Protocol</h2>' % H2)
    w('<p %s>TWO uses NEAR Protocol as its chain-abstraction layer. NEAR Intents provides '
      'the infrastructure for routing value between supported assets and networks, '
      'allowing TWO to keep the cross-chain complexity behind the product.</p>' % BODY)
    w('<p %s>Pump.fun provides the launch and market. TWO provides the dual-reserve '
      'logic. NEAR provides the cross-chain infrastructure.</p>' % BODY)
    w('<div class="two-grid">')
    for title, text in NEAR_FEATURES:
        w('<div class="two-card"><h3 %s>%s</h3><p %s>%s</p></div>' % (H3, title, BODY, text))
    w('</div></article>')

    w('<article class="two-block" id="examples">')
    w('<h2 %s>Two sides, configured</h2>' % H2)
    w('<p %s>Illustrative configurations of the dual-reserve layer. These are examples of '
      'how a launch can be set up, not live tokens.</p>' % BODY)
    w('<div class="two-grid two-grid-4">')
    for ticker, buy, sell in TOKENS:
        w('<div class="two-card two-token"><h3 %s>%s</h3>'
          '<p class="two-row"><span class="two-tag two-tag-buy">BUY</span>'
          '<span class="two-side-label">%s</span></p>'
          '<p class="two-row"><span class="two-tag two-tag-sell">SELL</span>'
          '<span class="two-side-label">%s</span></p></div>' % (H3, ticker, buy, sell))
    w('</div>')
    w('<p class="framer-text framer-styles-preset-1hy5wa5 two-note">*Availability depends on supported on-chain infrastructure and '
      'applicable requirements.</p>')
    w('</article>')

    w('<article class="two-block two-cta">')
    w('<h2 %s>Launch both sides.</h2>' % H2)
    w('<p %s>Choose what buys build. Choose what sells build. Launch with TWO.</p>' % BODY)
    w('<div class="two-cta-row">')
    w('<a class="two-btn" href="/launch">Launch a Token</a>')
    w('<a class="two-btn two-btn-ghost" href="https://x.com/twopairpad" '
      'target="_blank" rel="noopener noreferrer">@twopairpad</a>')
    w('</div></article>')

    w('</div></section>')
    return "".join(out)


DOCS_CSS = """
  /* --- page /docs : meme palette et memes presets typo que la home --- */
  .two-docs { width: 100%; padding: 160px 20px 120px; position: relative; z-index: 1; }
  .two-docs-inner { max-width: 760px; margin: 0 auto; }
  /* les presets Framer sont centres par defaut : on repasse en fer a gauche */
  .two-docs h1.framer-text, .two-docs h2.framer-text { --framer-text-alignment: start !important; }
  .two-doc-head { padding-bottom: 8px; }
  .two-doc-head h1 { margin-bottom: 20px; }
  .two-eyebrow { --framer-font-size: 13px; --framer-line-height: 20px;
                 --framer-text-transform: uppercase; --framer-letter-spacing: 0.08em;
                 --framer-text-color: var(--token-7b94042f-46e1-4e5a-b299-d70b54e0c9e6, #0009);
                 margin-bottom: 16px; }
  .two-block { margin-top: 88px; }
  .two-block > h2 { margin-bottom: 24px; }
  .two-block > p + p { margin-top: 16px; }
  .two-block p { --framer-text-color: var(--token-0eb99c75-a8b6-49d3-a538-56fb97aa639d, #000c); }

  .two-steps { list-style: none; margin: 0; padding: 0;
               display: flex; flex-direction: column; gap: 24px; }
  .two-steps li { display: flex; gap: 16px; align-items: flex-start; }
  .two-step-n { flex: none; width: 32px; height: 32px; border-radius: 999px;
                background: var(--token-65c699a8-ce3c-4d6e-aa13-67fa67a3f66e, #8df868);
                color: #000; font-family: "Delight Semi Bold", sans-serif;
                font-size: 15px; line-height: 32px; text-align: center; }
  .two-steps h3 { margin-bottom: 4px; }

  .two-sides { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
  .two-side { display: flex; align-items: center; gap: 10px; padding: 12px 16px;
              border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014);
              border-radius: 12px; }
  .two-arrow { color: var(--token-7b94042f-46e1-4e5a-b299-d70b54e0c9e6, #0009); }
  .two-tag { font-family: "Inter", sans-serif; font-size: 12px; font-weight: 600;
             letter-spacing: 0.06em; padding: 4px 8px; border-radius: 6px; color: #000; }
  .two-tag-buy { background: var(--token-65c699a8-ce3c-4d6e-aa13-67fa67a3f66e, #8df868); }
  .two-tag-sell { background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8);
                  border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .two-side-label { font-family: "Inter", sans-serif; font-size: 15px; color: #000; }

  .two-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 28px; }
  .two-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .two-card { padding: 24px; border-radius: 16px;
              border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014);
              background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8); }
  .two-card h3 { margin-bottom: 8px; }
  .two-token .two-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }

  .two-note { margin-top: 20px;
              --framer-text-color: var(--token-7b94042f-46e1-4e5a-b299-d70b54e0c9e6, #0009) !important; }

  .two-cta { margin-top: 96px; padding: 48px 40px; border-radius: 20px;
             background: var(--token-65c699a8-ce3c-4d6e-aa13-67fa67a3f66e, #8df868); }
  .two-cta h2 { margin-bottom: 12px; }
  .two-cta p { --framer-text-color: #000 !important; }
  .two-cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  .two-btn { display: inline-flex; align-items: center; justify-content: center;
             padding: 14px 24px; border-radius: 10px; background: #000; color: #fff;
             font-family: "Inter", sans-serif; font-size: 15px; font-weight: 600;
             text-decoration: none; }
  .two-btn-ghost { background: transparent; color: #000; border: 1px solid #0003; }

  @media (max-width: 809.98px) {
    .two-docs { padding: 120px 20px 80px; }
    .two-block { margin-top: 56px; }
    .two-grid, .two-grid-4 { grid-template-columns: 1fr; }
    .two-cta { padding: 32px 24px; }
  }
"""


def build_docs(home_html):
    d = home_html
    d = d.replace("<title>%s</title>" % TITLE, "<title>%s</title>" % DOCS_TITLE)
    d = d.replace('content="%s"' % DESC, 'content="%s"' % DOCS_DESC)
    d = d.replace('<meta property="og:title" content="%s">' % TITLE,
                  '<meta property="og:title" content="%s">' % DOCS_TITLE)
    d = d.replace('<meta name="twitter:title" content="%s">' % TITLE,
                  '<meta name="twitter:title" content="%s">' % DOCS_TITLE)

    i = d.find('<section class="framer-1vnnloy"')
    j = d.find("</section>", i) + len("</section>")
    if i == -1 or j < i:
        raise SystemExit("docs: hero introuvable")
    d = d[:i] + docs_body() + d[j:]

    d = d.replace("</style>\n</body>", DOCS_CSS + "</style>\n</body>")

    docs_out = os.path.join(os.path.dirname(OUT), "docs.html")
    open(docs_out, "w", encoding="utf-8").write(d)
    print("ecrit %s (%d octets)" % (docs_out, len(d)))


build_docs(s)



# --------------------------------------------------------------- page /launch
# Meme structure que usepaid.app/launch : carte hero, puis grande carte en deux
# colonnes (formulaire a gauche, apercu live a droite), footer de formulaire.
# Les champs "handle X / X Money sent to" de Paid sont remplaces par les DEUX
# cases de selection des tokens a pairer : buy side et sell side.

LAUNCH_TITLE = "Launch — TWO"
LAUNCH_DESC = ("Launch a token on Pump.fun with two programmable reserves: choose what "
               "buy-side activity builds and what sell-side activity builds.")

RESERVES = [
    ("SOL", "SOL"), ("USDC", "USDC"), ("BTC", "BTC"), ("ETH", "ETH"),
    ("NEAR", "NEAR"), ("ZEC", "ZEC"), ("XMR", "XMR*"),
    ("SPACEX", "SpaceX*"), ("TESLA", "Tesla*"),
]


def options(selected):
    return "".join('<option value="%s"%s>%s</option>'
                   % (v, " selected" if v == selected else "", label)
                   for v, label in RESERVES)


def field(label, inner, hint=""):
    h = '<p class="tl-hint">%s</p>' % hint if hint else ""
    return '<div class="tl-field"><label class="tl-label">%s</label>%s%s</div>' % (label, inner, h)


LAUNCH_JS = """<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  function sync(){
    var name = $("tl-name").value.trim(), tick = $("tl-ticker").value.trim();
    $("tl-p-name").textContent = name || "Token name";
    $("tl-p-ticker").textContent = tick ? tick.toUpperCase() : "TICKER";
    var buy = $("tl-buy"), sell = $("tl-sell");
    var b = buy.options[buy.selectedIndex].text, s = sell.options[sell.selectedIndex].text;
    $("tl-p-buy").textContent = b; $("tl-s-buy").textContent = b;
    $("tl-p-sell").textContent = s; $("tl-s-sell").textContent = s;
    $("tl-same").hidden = (b !== s);
    $("tl-count").textContent = $("tl-desc").value.length;
  }
  ["tl-name","tl-ticker","tl-buy","tl-sell","tl-desc"].forEach(function(id){
    var el = $(id);
    if (el) { el.addEventListener("input", sync); el.addEventListener("change", sync); }
  });
  sync();
})();
</script>"""


def launch_body():
    o = []
    w = o.append
    w('<section class="two-launch"><div class="two-page-inner">')

    w('<section class="pg-hero"><div class="pg-hero-bg" aria-hidden="true"></div>'
      '<div class="pg-hero-body">'
      '<h1 class="framer-text framer-styles-preset-sqbruw">Launch a token with two sides</h1>'
      '<p class="framer-text framer-styles-preset-1hdbxly">Deploy on Pump.fun and pair your '
      'launch with two reserves. Buys build one side, sells build the other, routed through '
      'NEAR Protocol.</p></div></section>')

    w('<div class="tl-card">')

    # ---- colonne gauche : formulaire ----
    w('<section class="tl-form">')
    w('<div class="tl-form-head">'
      '<h2 class="framer-text framer-styles-preset-1eqcm1y">Launch token</h2>'
      '<div class="pg-pills"><button type="button" class="pg-pill is-on">Pump.fun</button>'
      '<button type="button" class="pg-pill" disabled>More soon</button></div></div>')

    # les deux cases
    w('<fieldset class="tl-box"><legend>Pair two reserves</legend>'
      '<div class="tl-sides">'
      '<div class="tl-side"><span class="two-tag two-tag-buy">BUY</span>'
      '<label class="tl-side-label" for="tl-buy">Buy side builds</label>'
      '<div class="tl-select"><select id="tl-buy">%s</select></div></div>'
      '<div class="tl-side"><span class="two-tag two-tag-sell">SELL</span>'
      '<label class="tl-side-label" for="tl-sell">Sell side builds</label>'
      '<div class="tl-select"><select id="tl-sell">%s</select></div></div>'
      '</div>'
      '<p class="tl-warn" id="tl-same" hidden>Both sides build the same asset — pick two '
      'different reserves to use the dual-reserve layer.</p>'
      '<p class="tl-hint">Pick the reserve asset each side of the market builds. Eligible value '
      'is routed between supported assets through NEAR Intents. SOL is still needed for network '
      'fees.</p></fieldset>' % (options("SOL"), options("USDC")))

    w('<hr class="pg-rule">')
    w('<div class="tl-grid2">%s%s</div>' % (
        field("Name", '<input id="tl-name" class="tl-input" type="text" placeholder="Elon Reserve" maxlength="32">'),
        field("Ticker", '<input id="tl-ticker" class="tl-input" type="text" placeholder="ELON" maxlength="10">')))

    w(field("Token image",
            '<div class="tl-upload"><span class="tl-upload-icon" aria-hidden="true"></span>'
            '<span class="tl-upload-text">Choose image</span>'
            '<input id="tl-image" type="file" accept="image/*" class="tl-file"></div>'))

    w(field("Description",
            '<textarea id="tl-desc" class="tl-input tl-textarea" rows="3" maxlength="256" '
            'placeholder="What the token is."></textarea>',
            '<span id="tl-count">0</span>/256 characters'))

    w('<details class="tl-details"><summary>Social links (optional)</summary>'
      '<div class="tl-details-body">'
      '<input class="tl-input" type="text" placeholder="X">'
      '<input class="tl-input" type="text" placeholder="Telegram">'
      '<input class="tl-input" type="text" placeholder="Website"></div></details>')

    w('<hr class="pg-rule">')
    w(field("Initial buy (optional)",
            '<div class="tl-amount"><input id="tl-buyin" class="tl-input" type="text" '
            'inputmode="decimal" placeholder="0.00"><span class="tl-amount-unit">SOL</span></div>',
            "Buy some of your token when it launches."))

    w('<hr class="pg-rule">')
    w('<footer class="tl-foot">'
      '<label class="tl-check"><input type="checkbox"> <span>I agree to the Terms of Use and '
      'have read the Disclosures.</span></label>'
      '<button type="button" class="two-btn tl-submit">Connect wallet</button>'
      '<p class="pg-note">Nothing is deployed from this page yet. Launching runs through '
      'Pump.fun, with reserve routing handled by TWO on NEAR Protocol.</p></footer>')
    w('</section>')

    # ---- colonne droite : apercu ----
    w('<aside class="tl-aside"><span class="pg-label">Preview</span>'
      '<div class="tl-preview"><div class="tl-banner" aria-hidden="true">—</div>'
      '<div class="tl-preview-head"><span class="ex-name" id="tl-p-name">Token name</span>'
      '<span class="ex-ticker" id="tl-p-ticker">TICKER</span></div>'
      '<div class="tl-preview-sides">'
      '<div class="pg-row"><span class="two-tag two-tag-buy">BUY</span>'
      '<span class="two-side-label" id="tl-p-buy">SOL</span></div>'
      '<div class="pg-row"><span class="two-tag two-tag-sell">SELL</span>'
      '<span class="two-side-label" id="tl-p-sell">USDC</span></div></div></div>'
      '<dl class="pg-summary">'
      '<div><dt>Launch platform</dt><dd>Pump.fun</dd></div>'
      '<div><dt>Buy side builds</dt><dd id="tl-s-buy">SOL</dd></div>'
      '<div><dt>Sell side builds</dt><dd id="tl-s-sell">USDC</dd></div>'
      '<div><dt>Routing</dt><dd>NEAR Intents</dd></div></dl>'
      '<p class="pg-note">*Availability depends on supported on-chain infrastructure and '
      'applicable requirements. Tokenized equity exposure requires appropriate '
      'representations, custody and regulatory infrastructure.</p></aside>')

    w('</div></div></section>')
    w(LAUNCH_JS)
    return "".join(o)


# -------------------------------------------------------------- page /explore
# Meme structure que usepaid.app/explore : carte hero avec CTA, bandeau
# "Trending" en marquee, puis section "All launches" (filtres + recherche + tri)
# et grille de cartes. Les colonnes "Sent / X handle" de Paid deviennent la
# paire de reserves BUY / SELL.

EXPLORE_TITLE = "Explore — TWO"
EXPLORE_DESC = ("Browse token launches paired with two programmable reserves: one built by "
                "buys, one built by sells, routed through NEAR Protocol.")

# donnees d'exemple, explicitement presentees comme un apercu (pas des tokens live)
SAMPLE = [
    ("Elon Reserve", "ELON", "SpaceX*", "Tesla*", "$3.1M", "23d", "Ffbq7n…RGgYvn"),
    ("Macro Hedge", "MACRO", "BTC", "USDC", "$1.4M", "11d", "4LBPTZ…PtzbiZ"),
    ("Chainpair", "CHAIN", "SOL", "ETH", "$842K", "9d", "4bKRCn…TwT5KY"),
    ("Privacy Pair", "PRIVACY", "ZEC", "XMR*", "$517K", "6d", "79FCJq…Z7cLrm"),
    ("Near Basis", "BASIS", "NEAR", "USDC", "$392K", "4d", "8kQpLm…Xv2sTa"),
    ("Long Short", "LOSH", "BTC", "ETH", "$268K", "2d", "2Ttvbn…Qp9Lde"),
    ("Stable Drift", "DRIFT", "USDC", "SOL", "$151K", "31h", "6mWxZr…Jk4Nby"),
    ("Two Index", "INDEX", "ETH", "NEAR", "$96K", "14h", "9pRuVc…Ld7Qzx"),
]


def marquee_row(t):
    name, ticker, buy, sell = t[0], t[1], t[2], t[3]
    return ('<div class="ex-row">'
            '<span class="ex-avatar" aria-hidden="true">%s</span>'
            '<span class="ex-row-id"><span class="ex-name">%s</span>'
            '<span class="ex-ticker">%s</span></span>'
            '<span class="ex-row-pair">'
            '<span class="two-tag two-tag-buy">BUY</span><span class="two-side-label">%s</span>'
            '<span class="two-tag two-tag-sell">SELL</span><span class="two-side-label">%s</span>'
            '</span></div>' % (ticker[0], name, ticker, buy, sell))


def explore_card(t, order):
    name, ticker, buy, sell, mc, age, addr = t
    return ('<article class="ex-card" data-name="%s %s %s" data-mc="%d" data-recent="%d">'
            '<div class="ex-card-media"><span class="ex-card-mark" aria-hidden="true">%s</span>'
            '<span class="ex-age">%s</span></div>'
            '<div class="ex-card-body">'
            '<div class="ex-card-title"><span class="ex-name">%s</span>'
            '<span class="ex-ticker">%s</span></div>'
            '<div class="ex-card-pair">'
            '<div class="pg-row"><span class="two-tag two-tag-buy">BUY</span>'
            '<span class="two-side-label">%s</span></div>'
            '<div class="pg-row"><span class="two-tag two-tag-sell">SELL</span>'
            '<span class="two-side-label">%s</span></div></div>'
            '<div class="ex-card-foot"><span class="ex-mc">%s <span class="ex-unit">MC</span></span>'
            '<span class="ex-addr">%s</span></div>'
            '</div></article>'
            % (name.lower(), ticker.lower(), addr.lower(), len(SAMPLE) - order, order,
               ticker[0], age, name, ticker, buy, sell, mc, addr))


EXPLORE_JS = """<script>
(function(){
  var grid = document.getElementById("ex-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.children);
  var search = document.getElementById("ex-search");
  function filter(){
    var q = (search.value || "").trim().toLowerCase();
    cards.forEach(function(c){
      c.hidden = q !== "" && c.dataset.name.indexOf(q) === -1;
    });
  }
  search.addEventListener("input", filter);
  document.querySelectorAll("[data-sort]").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll("[data-sort]").forEach(function(b){ b.classList.remove("is-on"); });
      btn.classList.add("is-on");
      var key = btn.dataset.sort;
      cards.slice().sort(function(a, b){
        return Number(b.dataset[key]) - Number(a.dataset[key]);
      }).forEach(function(c){ grid.appendChild(c); });
    });
  });
})();
</script>"""


def explore_body():
    o = []
    w = o.append
    w('<section class="two-explore"><div class="two-page-inner">')

    w('<section class="pg-hero"><div class="pg-hero-bg" aria-hidden="true"></div>'
      '<div class="pg-hero-body">'
      '<div class="pg-hero-head">'
      '<h1 class="framer-text framer-styles-preset-sqbruw">Explore tokens</h1>'
      '<a class="two-btn" href="/launch">Launch a token</a></div>'
      '<p class="framer-text framer-styles-preset-1hdbxly">Pump.fun runs the market. TWO pairs '
      'each launch with two reserves — one built by buys, one built by sells — and '
      'routes eligible value through NEAR Protocol.</p></div></section>')

    w('<section class="ex-section">'
      '<div class="ex-head"><h2 class="ex-h2">Trending</h2>'
      '<a class="ex-link" href="#all">View all</a></div>'
      '<div class="ex-marquee"><div class="ex-track">%s%s</div></div></section>'
      % ("".join(marquee_row(t) for t in SAMPLE),
         "".join(marquee_row(t) for t in SAMPLE)))

    w('<section class="ex-section" id="all">')
    w('<div class="ex-head"><h2 class="ex-h2">All launches <span class="ex-badge">Preview '
      'data</span></h2>'
      '<div class="ex-controls">'
      '<div class="pg-pills"><button type="button" class="pg-pill is-on">Pump.fun</button></div>'
      '<input id="ex-search" class="ex-search" type="search" placeholder="Search by name, '
      'ticker or contract address">'
      '<div class="ex-sort">'
      '<button type="button" class="pg-pill is-on" data-sort="mc">Market cap</button>'
      '<button type="button" class="pg-pill" data-sort="recent">Recent</button>'
      '</div></div></div>')
    w('<div class="ex-grid" id="ex-grid">%s</div>'
      % "".join(explore_card(t, i) for i, t in enumerate(SAMPLE)))
    w('<p class="pg-note">Illustrative configurations of the dual-reserve layer, not live '
      'tokens. *Availability depends on supported on-chain infrastructure and applicable '
      'requirements.</p>')
    w('</section>')

    w('</div></section>')
    w(EXPLORE_JS)
    return "".join(o)


PAGES_CSS = """
  /* --- pages /launch et /explore : structure usepaid.app, identite TWO --- */
  .two-launch, .two-explore { width: 100%; padding: 140px 20px 100px; position: relative; z-index: 1; }
  .two-page-inner { max-width: 1180px; margin: 0 auto;
                    display: flex; flex-direction: column; gap: 24px; }
  .two-launch h1.framer-text, .two-launch h2.framer-text,
  .two-explore h1.framer-text, .two-explore h2.framer-text {
      --framer-text-alignment: start !important; }

  .pg-hero { position: relative; overflow: hidden; border-radius: 24px;
             border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .pg-hero-bg { position: absolute; inset: 0;
                background: linear-gradient(120deg,
                  var(--token-65c699a8-ce3c-4d6e-aa13-67fa67a3f66e, #8df868) 0%,
                  var(--token-fa0ea234-a5a4-4804-8292-126e96a243f8, #bdfba7) 55%,
                  #eafce3 100%); }
  .pg-hero-body { position: relative; padding: 44px 40px; }
  .pg-hero-body h1 { margin-bottom: 12px; }
  .pg-hero-body p { max-width: 640px; --framer-text-color: #000c; }
  .pg-hero-head { display: flex; flex-wrap: wrap; align-items: center;
                  justify-content: space-between; gap: 16px; }
  .pg-hero-head h1 { margin-bottom: 0; }

  .pg-pills { display: flex; gap: 6px; }
  .pg-pill { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 500;
             padding: 8px 14px; border-radius: 999px; cursor: pointer; color: #000;
             border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014);
             background: #fff; }
  .pg-pill.is-on { background: var(--token-65c699a8-ce3c-4d6e-aa13-67fa67a3f66e, #8df868);
                   border-color: transparent; }
  .pg-pill[disabled] { opacity: .4; cursor: default; }
  .pg-rule { border: 0; height: 1px; margin: 4px 0;
             background: var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .pg-row { display: flex; align-items: center; gap: 10px; }
  .pg-label { font-family: "Inter", sans-serif; font-size: 11px; letter-spacing: .08em;
              text-transform: uppercase; color: #0009; }
  .pg-note { font-family: "Inter", sans-serif; font-size: 12px; line-height: 18px;
             color: var(--token-7b94042f-46e1-4e5a-b299-d70b54e0c9e6, #0009); }
  .pg-summary { display: flex; flex-direction: column; margin: 0; }
  .pg-summary > div { display: flex; align-items: center; justify-content: space-between;
                      gap: 12px; padding: 11px 0;
                      border-bottom: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .pg-summary dt { font-family: "Inter", sans-serif; font-size: 12px; color: #0009; }
  .pg-summary dd { font-family: "Inter", sans-serif; font-size: 13px; color: #000; margin: 0; }

  /* --- /launch --- */
  .tl-card { display: grid; grid-template-columns: 1.45fr 1fr; overflow: hidden;
             border-radius: 28px;
             border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .tl-form { display: flex; flex-direction: column; gap: 20px; padding: 36px; min-width: 0; }
  .tl-form-head { display: flex; flex-wrap: wrap; align-items: center;
                  justify-content: space-between; gap: 12px; }
  .tl-box { border-radius: 18px; padding: 18px;
            border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014);
            background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8); }
  .tl-box legend { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 600;
                   color: #000; padding: 0 6px; }
  .tl-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tl-side { display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
             padding: 16px; border-radius: 14px; background: #fff;
             border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .tl-side-label { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 500; color: #000c; }
  .tl-select { position: relative; width: 100%; }
  .tl-select:after { content: ""; position: absolute; right: 14px; top: 50%; width: 8px;
                     height: 8px; margin-top: -6px; pointer-events: none;
                     border-right: 1.5px solid #0009; border-bottom: 1.5px solid #0009;
                     transform: rotate(45deg); }
  .tl-select select { -webkit-appearance: none; appearance: none; width: 100%; height: 48px;
                      padding: 0 34px 0 14px; border-radius: 12px; background: #fff;
                      font-family: "Inter", sans-serif; font-size: 15px; color: #000;
                      border: 1px solid var(--token-8bc73e82-e238-475b-bc46-cda958c57f83, #00000024); }
  .tl-warn { font-family: "Inter", sans-serif; font-size: 12px; line-height: 18px;
             margin-top: 10px; color: #000; background: #fff3cd; border-radius: 10px;
             padding: 8px 10px; }
  .tl-hint { font-family: "Inter", sans-serif; font-size: 12px; line-height: 18px;
             color: var(--token-7b94042f-46e1-4e5a-b299-d70b54e0c9e6, #0009); margin-top: 10px; }
  .tl-field { display: flex; flex-direction: column; gap: 7px; }
  .tl-field .tl-hint { margin-top: 0; }
  .tl-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .tl-label { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 500; color: #000; }
  .tl-input { width: 100%; height: 48px; padding: 0 14px; border-radius: 14px;
              font-family: "Inter", sans-serif; font-size: 15px; color: #000; background: #fff;
              border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .tl-input::placeholder { color: #0006; }
  .tl-input:focus { outline: none; border-color: #000; }
  .tl-textarea { height: auto; padding: 12px 14px; resize: vertical; line-height: 22px; }
  .tl-upload { position: relative; display: flex; align-items: center; gap: 12px; height: 76px;
               padding: 0 16px; border-radius: 14px; cursor: pointer;
               border: 1px dashed var(--token-8bc73e82-e238-475b-bc46-cda958c57f83, #00000024); }
  .tl-upload-icon { width: 46px; height: 46px; border-radius: 12px; flex: none;
                    background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8); }
  .tl-upload-text { font-family: "Inter", sans-serif; font-size: 14px; color: #000; }
  .tl-file { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .tl-details summary { font-family: "Inter", sans-serif; font-size: 13px; color: #0009;
                        cursor: pointer; }
  .tl-details-body { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; }
  .tl-amount { position: relative; }
  .tl-amount-unit { position: absolute; right: 14px; top: 0; line-height: 48px;
                    font-family: "Inter", sans-serif; font-size: 13px; color: #0009; }
  .tl-foot { display: flex; flex-direction: column; gap: 14px; }
  .tl-check { display: flex; align-items: flex-start; gap: 10px;
              font-family: "Inter", sans-serif; font-size: 13px; line-height: 19px; color: #000c; }
  .tl-check input { margin-top: 2px; }
  .tl-submit { align-self: flex-start; }
  .tl-aside { display: flex; flex-direction: column; gap: 16px; padding: 36px; min-width: 0;
              background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8);
              border-left: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .tl-preview { border-radius: 18px; padding: 14px; background: #fff;
                border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .tl-banner { display: flex; align-items: center; justify-content: center; aspect-ratio: 12/5;
               border-radius: 12px; margin-bottom: 12px; color: #0002;
               font-family: "Delight Semi Bold", sans-serif; font-size: 40px;
               background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8); }
  .tl-preview-head { display: flex; align-items: baseline; gap: 8px; }
  .tl-preview-sides { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }

  /* --- /explore --- */
  .ex-section { display: flex; flex-direction: column; gap: 14px; }
  .ex-head { display: flex; flex-wrap: wrap; align-items: center;
             justify-content: space-between; gap: 12px; }
  .ex-h2 { font-family: "Inter", sans-serif; font-size: 15px; font-weight: 600; color: #000;
           display: flex; align-items: center; gap: 8px; }
  .ex-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 999px;
              background: var(--token-f6005f01-5b3a-4c85-8b10-f9e50d9d7648, #f8f8f8);
              color: #0009;
              border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .ex-link { font-family: "Inter", sans-serif; font-size: 13px; color: #0009; text-decoration: none; }
  .ex-link:hover { color: #000; }
  .ex-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .ex-search { height: 36px; min-width: 260px; padding: 0 14px; border-radius: 999px;
               font-family: "Inter", sans-serif; font-size: 13px; color: #000; background: #fff;
               border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .ex-search:focus { outline: none; border-color: #000; }
  .ex-sort { display: flex; gap: 6px; }

  .ex-marquee { overflow: hidden; }
  .ex-track { display: flex; gap: 12px; width: max-content; animation: ex-scroll 46s linear infinite; }
  .ex-marquee:hover .ex-track { animation-play-state: paused; }
  @keyframes ex-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (prefers-reduced-motion: reduce) {
    .ex-track { animation: none; }
    .ex-marquee { overflow-x: auto; }
  }
  .ex-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; flex: none;
            border-radius: 14px; background: #fff;
            border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .ex-avatar { width: 36px; height: 36px; border-radius: 10px; flex: none; display: flex;
               align-items: center; justify-content: center;
               font-family: "Delight Semi Bold", sans-serif; font-size: 15px; color: #000;
               background: var(--token-fa0ea234-a5a4-4804-8292-126e96a243f8, #bdfba7); }
  .ex-row-id { display: flex; flex-direction: column; }
  .ex-row-pair { display: flex; align-items: center; gap: 8px; padding-left: 8px; }
  .ex-name { font-family: "Inter", sans-serif; font-size: 14px; font-weight: 600; color: #000;
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .ex-ticker { font-family: "Inter", sans-serif; font-size: 11px; color: #0006; flex: none; }

  .ex-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .ex-card { border-radius: 18px; overflow: hidden; background: #fff;
             border: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .ex-card[hidden] { display: none; }
  .ex-card-media { position: relative; aspect-ratio: 16/9; display: flex; align-items: center;
                   justify-content: center;
                   background: var(--token-fa0ea234-a5a4-4804-8292-126e96a243f8, #bdfba7); }
  .ex-card-mark { font-family: "Delight Semi Bold", sans-serif; font-size: 34px; color: #0002; }
  .ex-age { position: absolute; top: 8px; right: 8px; font-family: "Inter", sans-serif;
            font-size: 11px; color: #000; background: #ffffffd9; border-radius: 999px;
            padding: 2px 8px; }
  .ex-card-body { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
  .ex-card-title { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .ex-card-pair { display: flex; flex-direction: column; gap: 6px; }
  .ex-card-foot { display: flex; align-items: baseline; justify-content: space-between;
                  gap: 8px; padding-top: 10px;
                  border-top: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
  .ex-mc { font-family: "Inter", sans-serif; font-size: 14px; font-weight: 600; color: #000; }
  .ex-unit { font-size: 11px; font-weight: 400; color: #0006; }
  .ex-addr { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
             color: #0006; }

  @media (max-width: 1199.98px) {
    .tl-card { grid-template-columns: 1fr; }
    .tl-aside { border-left: 0;
                border-top: 1px solid var(--token-d09ba408-09f2-4b68-85f6-c68f93808ca6, #00000014); }
    .ex-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 809.98px) {
    .two-launch, .two-explore { padding: 110px 20px 72px; }
    .pg-hero-body { padding: 32px 24px; }
    .tl-form, .tl-aside { padding: 24px; }
    .tl-sides, .tl-grid2 { grid-template-columns: 1fr; }
    .ex-grid { grid-template-columns: repeat(2, 1fr); }
    .ex-search { min-width: 100%; }
  }
"""


def build_page(home_html, filename, title, desc, body_html):
    d = home_html
    d = d.replace("<title>%s</title>" % TITLE, "<title>%s</title>" % title)
    d = d.replace('content="%s"' % DESC, 'content="%s"' % desc)
    d = d.replace('<meta property="og:title" content="%s">' % TITLE,
                  '<meta property="og:title" content="%s">' % title)
    d = d.replace('<meta name="twitter:title" content="%s">' % TITLE,
                  '<meta name="twitter:title" content="%s">' % title)
    i = d.find('<section class="framer-1vnnloy"')
    j = d.find("</section>", i) + len("</section>")
    if i == -1 or j < i:
        raise SystemExit("%s : hero introuvable" % filename)
    d = d[:i] + body_html + d[j:]
    d = d.replace("</style>\n</body>", DOCS_CSS + PAGES_CSS + "</style>\n</body>")
    out = os.path.join(os.path.dirname(OUT), filename)
    open(out, "w", encoding="utf-8").write(d)
    print("ecrit %s (%d octets)" % (out, len(d)))


build_page(s, "launch.html", LAUNCH_TITLE, LAUNCH_DESC, launch_body())
build_page(s, "explore.html", EXPLORE_TITLE, EXPLORE_DESC, explore_body())
