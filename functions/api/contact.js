const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 5;
const memoryLimits = new Map();

export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
    const limited = await isRateLimited(ip, env);
    if (limited) {
      return json({ message: "Too many messages. Please try again later." }, 429);
    }

    const payload = await readPayload(request);
    if (payload.website) {
      return json({ ok: true });
    }

    const data = sanitizePayload(payload);
    const error = validatePayload(data);
    if (error) {
      return json({ message: error }, 400);
    }

    await deliverEmail(data, env);
    return json({ ok: true });
  } catch (error) {
    return json({ message: error.message || "Message could not be sent." }, 500);
  }
}

export async function onRequestOptions() {
  return json({ ok: true });
}

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

function sanitizePayload(payload) {
  return {
    name: clean(payload.name, 80),
    email: clean(payload.email, 120),
    social_handle: clean(payload.social_handle, 120),
    message: clean(payload.message, 2400),
    platform: clean(payload.platform || "", 40),
  };
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validatePayload(data) {
  if (!data.name || !data.email || !data.social_handle || !data.message) {
    return "Please fill in all required fields.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return "Please enter a valid email address.";
  }

  if (data.message.length < 12) {
    return "Please include a little more context in your message.";
  }

  return "";
}

async function isRateLimited(ip, env) {
  const key = `contact:${ip}`;

  if (env.CONTACT_RATE_LIMIT) {
    const record = JSON.parse((await env.CONTACT_RATE_LIMIT.get(key)) || "{\"count\":0}");
    if (record.count >= RATE_LIMIT_MAX) return true;
    await env.CONTACT_RATE_LIMIT.put(key, JSON.stringify({ count: record.count + 1 }), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    });
    return false;
  }

  const now = Date.now();
  const record = memoryLimits.get(key) || { count: 0, expires: now + RATE_LIMIT_WINDOW_SECONDS * 1000 };
  if (record.expires < now) {
    memoryLimits.set(key, { count: 1, expires: now + RATE_LIMIT_WINDOW_SECONDS * 1000 });
    return false;
  }
  if (record.count >= RATE_LIMIT_MAX) return true;
  record.count += 1;
  memoryLimits.set(key, record);
  return false;
}

async function deliverEmail(data, env) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) {
    throw new Error("Contact email delivery is not configured yet.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>",
      to: [env.CONTACT_TO_EMAIL],
      reply_to: data.email,
      subject: `Portfolio inquiry from ${data.name}`,
      text: [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Social: ${data.social_handle}`,
        "",
        data.message,
      ].join("\n"),
      html: `
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Social:</strong> ${escapeHtml(data.social_handle)}</p>
        <p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error("Email service rejected the message.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
