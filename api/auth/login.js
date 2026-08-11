import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    // In local dev without OAuth credentials configured, provide a mock dev login flow if requested or prompt for config
    const host = req.headers?.host || "127.0.0.1:4173";
    if (host.includes("127.0.0.1") || host.includes("localhost")) {
      // Local dev mode redirect to dev callback
      return res.redirect("/api/auth/callback?code=mock_dev_code&state=dev");
    }
    return res.status(500).json({ message: "GITHUB_CLIENT_ID is not configured on the server." });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", "repo");
  authorizeUrl.searchParams.set("state", state);

  return res.redirect(authorizeUrl.toString());
}
