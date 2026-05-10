export function initReveals() {
  const items = document.querySelectorAll(".reveal");

  if (!items.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  items.forEach((item) => observer.observe(item));
}

export function initCommunityPreview() {
  const buttons = document.querySelectorAll("[data-preview-image]");

  buttons.forEach((button) => {
    let timer;
    const clear = () => {
      window.clearTimeout(timer);
      button.classList.remove("is-previewing");
    };

    button.addEventListener("pointerdown", () => {
      timer = window.setTimeout(() => button.classList.add("is-previewing"), 220);
    });
    button.addEventListener("pointerup", clear);
    button.addEventListener("pointerleave", clear);
    button.addEventListener("pointercancel", clear);
  });
}
