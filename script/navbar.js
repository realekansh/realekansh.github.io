export function initNavbar() {
  const header = document.querySelector("[data-navbar]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-primary-nav]");
  const links = document.querySelectorAll("[data-nav-link]");

  if (header) {
    let lastScroll = 0;
    const updateHeader = () => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      header.classList.toggle("is-scrolled", currentScroll > 36);

      if (currentScroll > lastScroll && currentScroll > 120) {
        header.classList.add("is-hidden");
      } else {
        header.classList.remove("is-hidden");
      }
      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      const icon = toggle.querySelector("use");
      if (icon) {
        icon.setAttribute("href", `/assets/icons/icons.svg#${isOpen ? "close" : "menu"}`);
      }
    });

    links.forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        const icon = toggle.querySelector("use");
        if (icon) {
          icon.setAttribute("href", "/assets/icons/icons.svg#menu");
        }
      });
    });
  }

  const page = document.body.dataset.page || "home";
  links.forEach((link) => {
    if (link.dataset.navLink === page) {
      link.setAttribute("aria-current", "page");
    }
  });
}
