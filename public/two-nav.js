(() => {
  const normalize = (value) => {
    const path = new URL(value, window.location.href).pathname.replace(/\.html$/, "");
    return path === "/index" ? "/" : path.replace(/\/$/, "") || "/";
  };

  const current = normalize(window.location.pathname);
  document.querySelectorAll("nav a[href]").forEach((link) => {
    link.removeAttribute("data-framer-page-link-current");
    link.removeAttribute("aria-current");
    if (normalize(link.getAttribute("href")) === current) {
      link.setAttribute("data-framer-page-link-current", "true");
      link.setAttribute("aria-current", "page");
      link.dataset.twoCurrent = "true";
    }

    // The exported Framer runtime can retain click handlers from the original
    // prototype. Own internal navigation here so the static Next.js pages
    // always move between real routes.
    const href = link.getAttribute("href");
    if (href && href.startsWith("/") && !href.startsWith("//")) {
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        window.location.assign(href);
      }, true);
    }
  });

  document.querySelectorAll("nav [data-framer-name='Hamburger']").forEach((button) => {
    const nav = button.closest("nav");
    const menu = nav?.querySelector(".framer-1trxerv-container");
    if (!menu) return;

    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Toggle navigation");
    button.setAttribute("aria-expanded", "false");

    const setOpen = (open) => {
      button.setAttribute("aria-expanded", String(open));
      menu.dataset.twoOpen = String(open);
      menu.style.opacity = open ? "1" : "0";
      menu.style.pointerEvents = open ? "auto" : "none";
      menu.style.transform = "translateX(-50%)";
    };

    const toggle = () => setOpen(button.getAttribute("aria-expanded") !== "true");
    button.addEventListener("click", toggle);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  });

  const style = document.createElement("style");
  style.textContent = `
    /* Keep the imported header above the custom launch/explore page layer. */
    .framer-5v2ulr-container { z-index: 1000 !important; pointer-events: none !important; }
    .framer-5v2ulr-container nav { position: relative; z-index: 1001 !important; pointer-events: auto !important; }
    .framer-5v2ulr-container nav a { pointer-events: auto !important; touch-action: manipulation; }
    nav a[data-two-current="true"] { opacity: 1 !important; }
    nav a[data-two-current="true"] .framer-text { font-weight: 700 !important; }
    nav [data-framer-name="Hamburger"] { cursor: pointer; }
    @media (max-width: 1199.98px) {
      nav .framer-1trxerv-container[data-two-open="false"] { pointer-events: none !important; }
      nav .framer-1trxerv-container[data-two-open="true"] { opacity: 1 !important; pointer-events: auto !important; }
    }
  `;
  document.head.appendChild(style);
})();
