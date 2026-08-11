import { clearSessionCookie } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  clearSessionCookie(res);
  return res.status(200).json({ message: "Logged out successfully" });
}
