import { parseCookies, signToken, setSessionCookie, BLOG_OWNER } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { code, state } = req.query || {};

  // Mock dev mode fallback for local preview without live GitHub OAuth keys configured
  if (code === "mock_dev_code" && !process.env.GITHUB_CLIENT_ID) {
    const sessionToken = signToken({
      user: BLOG_OWNER,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    setSessionCookie(res, sessionToken);
    return res.redirect("/admin/");
  }

  // Mock non-owner testing code if requested
  if (code === "mock_unauthorized_code" && !process.env.GITHUB_CLIENT_ID) {
    const sessionToken = signToken({
      user: "random_github_user",
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    setSessionCookie(res, sessionToken);
    return res.redirect("/admin/");
  }

  if (!code) {
    return res.status(400).json({ message: "Missing authorization code." });
  }

  const cookies = parseCookies(req.headers?.cookie || "");
  if (cookies.oauth_state && state && cookies.oauth_state !== state) {
    return res.status(403).json({ message: "CSRF state validation failed." });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ message: "GitHub OAuth credentials not configured on server." });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ message: tokenData.error_description || "Failed to exchange OAuth code." });
    }

    // Fetch user details from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "User-Agent": "realekansh-portfolio-blog",
      },
    });

    const userData = await userResponse.json();
    const username = (userData.login || "").toLowerCase();

    // Issue signed HTTP-Only session token for the user
    const sessionToken = signToken({
      user: userData.login,
      avatar: userData.avatar_url,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    setSessionCookie(res, sessionToken);

    // If non-owner: redirect to /admin/ which will render 403 Forbidden Access Denied screen
    return res.redirect("/admin/");
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).json({ message: "Authentication failed." });
  }
}
