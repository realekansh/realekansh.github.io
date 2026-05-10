const platformPrefixes = {
  telegram: "t.me/",
  x: "twitter.com/",
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

    selector.querySelectorAll("[data-platform]").forEach((item) => {
      item.classList.remove("is-selected");
      item.setAttribute("aria-pressed", "false");
    });

    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
    
    input.placeholder = "Profile Link or Username";
    input.dataset.platform = button.dataset.platform;
    if (platformInput) {
      platformInput.value = button.dataset.platform;
    }

    const prefix = platformPrefixes[button.dataset.platform] || "";
    let currentValue = input.value;
    
    // Check if the current value starts with any known prefix and strip it
    for (const oldPrefix of Object.values(platformPrefixes)) {
      if (currentValue.startsWith(oldPrefix)) {
        currentValue = currentValue.substring(oldPrefix.length);
        break;
      }
    }
    
    // Apply the new prefix
    input.value = prefix + currentValue;
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
      setStatus("Please fill in all required fields.");
      return;
    }

    submit.disabled = true;
    submit.dataset.originalText = submit.textContent;
    submit.textContent = "Sending";
    setStatus("Sending your message...");

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
      const telegram = form.querySelector("[data-platform='telegram']");
      if (telegram) telegram.click();
      setStatus("Message sent. Thank you for reaching out.");
    } catch (error) {
      setStatus(`${error.message} You can also email notrealekansh@proton.me.`);
    } finally {
      submit.disabled = false;
      submit.textContent = submit.dataset.originalText || "Send Message";
    }
  });

  function setStatus(message) {
    if (status) status.textContent = message;
  }
}
