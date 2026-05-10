export function initTheme() {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-theme-toggle]");
  const storedTheme = localStorage.getItem("theme");
  const initialTheme = storedTheme || root.dataset.theme || "dark";

  setTheme(initialTheme);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
    });
  });

  function setTheme(theme) {
    root.dataset.theme = theme;
    buttons.forEach((button) => {
      const isLight = theme === "light";
      const icon = button.querySelector("use");
      button.setAttribute("aria-pressed", String(isLight));
      button.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
      if (icon) {
        icon.setAttribute("href", `/assets/icons/icons.svg#${isLight ? "sun" : "moon"}`);
      }
    });
  }
}
