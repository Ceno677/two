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
