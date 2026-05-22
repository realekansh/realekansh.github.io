const platformPrefixes = {
  telegram: "t.me/",
  x: "x.com/",
  linkedin: "linkedin.com/in/",
  discord: "discord.com/users/",
  instagram: "instagram.com/",
};

export function initSocialSelector() {
  const selector = document.querySelector("[data-platform-selector]");
  const input = document.querySelector("[data-social-handle]");
  const platformInput = document.querySelector("[data-platform-input]");

  if (!selector || !input) return;

  selector.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;

    if (button.classList.contains("is-selected")) {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
      input.dataset.platform = "";
      if (platformInput) platformInput.value = "";
      input.value = "";
      input.placeholder = "username";
      return;
    }

    selector.querySelectorAll("[data-platform]").forEach((item) => {
      item.classList.remove("is-selected");
      item.setAttribute("aria-pressed", "false");
    });

    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");

    const platform = button.dataset.platform;
    input.dataset.platform = platform;
    if (platformInput) {
      platformInput.value = platform;
    }

    const prefix = platformPrefixes[platform] || "";
    if (!input.value || Object.values(platformPrefixes).some((p) => input.value === p)) {
      input.value = prefix;
    }

    input.placeholder = `${prefix}username`;
    input.focus();
  });
}

export function initContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const status = form.querySelector("[data-form-status]");
  const submit = form.querySelector("[type='submit']");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (payload.website) return;

    const missing = ["name", "email", "social_handle", "message"].some((field) => {
      return !String(payload[field] || "").trim();
    });

    if (missing) {
      showPopup("error", "Missing Fields", "Please fill in all required fields before sending.");
      return;
    }

    submit.disabled = true;
    submit.dataset.originalText = submit.textContent;
    submit.textContent = "Sending...";
    setStatus("");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Message could not be sent.");
      }

      form.reset();
      selector_reset();
      showPopup("success", "Message Sent!", "Thank you for reaching out. I'll get back to you shortly.");
    } catch (error) {
      showPopup("error", "Sending Failed", `${error.message} You can also reach out at contact@realekansh.xyz`);
    } finally {
      submit.disabled = false;
      submit.textContent = submit.dataset.originalText || "Send Message";
    }
  });

  function selector_reset() {
    const selector = document.querySelector("[data-platform-selector]");
    const input = document.querySelector("[data-social-handle]");
    const platformInput = document.querySelector("[data-platform-input]");
    if (selector) {
      selector.querySelectorAll("[data-platform]").forEach((item) => {
        item.classList.remove("is-selected");
        item.setAttribute("aria-pressed", "false");
      });
    }
    if (input) {
      input.value = "";
      input.dataset.platform = "";
      input.placeholder = "Profile Link or Username";
    }
    if (platformInput) platformInput.value = "";
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }
}

function showPopup(type, title, message) {
  const existing = document.querySelector(".message-popup");
  if (existing) existing.remove();

  const isError = type === "error";

  const popup = document.createElement("div");
  popup.className = "message-popup";
  popup.innerHTML = `
    <div class="popup-overlay"></div>
    <div class="popup-content ${isError ? 'popup-error' : 'popup-success'}">
      <div class="popup-icon-ring ${isError ? 'ring-error' : 'ring-success'}">
        <svg class="icon popup-icon" aria-hidden="true">
          <use href="/assets/icons/icons.svg#${isError ? 'close' : 'mail'}"></use>
        </svg>
      </div>
      <h3>${title}</h3>
      <p>${message}</p>
      <button class="button button-primary close-popup">Got it</button>
    </div>
  `;
  document.body.appendChild(popup);

  requestAnimationFrame(() => popup.classList.add("is-visible"));

  const close = () => {
    popup.classList.remove("is-visible");
    setTimeout(() => popup.remove(), 200);
  };

  popup.querySelector(".close-popup").addEventListener("click", close);
  popup.querySelector(".popup-overlay").addEventListener("click", close);
}
