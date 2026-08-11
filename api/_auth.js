import crypto from "node:crypto";

const DEFAULT_SECRET = "default_antigravity_blog_secret_key_change_in_env_2026";
const SESSION_COOKIE_NAME = "blog_session";
export const BLOG_OWNER = (process.env.BLOG_OWNER || "realekansh").toLowerCase();

export function getSecret() {
  return process.env.SESSION_SECRET || DEFAULT_SECRET;
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const val = rest.join("=").trim();
    list[name] = decodeURIComponent(val);
  });
  return list;
}

export function signToken(data, secret = getSecret()) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

export function verifyToken(token, secret = getSecret()) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, hmac] = parts;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function getSessionFromReq(req) {
  const cookies = req.cookies || parseCookies(req.headers?.cookie || "");
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) return null;

  const session = verifyToken(sessionToken);
  if (!session || !session.user) return null;

  return session;
}

export function verifyAdminSession(req) {
  const session = getSessionFromReq(req);
  if (!session) return null;
  if (session.user.toLowerCase() !== BLOG_OWNER) return null;
  return session;
}

export function requireAdminAuth(req, res) {
  const session = getSessionFromReq(req);
  if (!session) {
    res.status(401).json({ message: "Unauthorized. Authentication required." });
    return null;
  }

  if (session.user.toLowerCase() !== BLOG_OWNER) {
    res.status(403).json({ message: `Forbidden. Identity '${session.user}' is not authorized to perform administrative actions.` });
    return null;
  }

  return session;
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  const cookieStr = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
  res.setHeader("Set-Cookie", cookieStr);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
