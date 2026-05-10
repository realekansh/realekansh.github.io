import { initTheme } from "./theme.js";
import { initNavbar } from "./navbar.js";
import { initReveals, initCommunityPreview } from "./transitions.js";
import { initContactForm, initSocialSelector } from "./contact.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNavbar();
  initReveals();
  initCommunityPreview();
  initSocialSelector();
  initContactForm();
});
