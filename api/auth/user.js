import { getSessionFromReq, BLOG_OWNER } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(200).json({ authenticated: false, isOwner: false });
  }

  const isOwner = session.user.toLowerCase() === BLOG_OWNER;

  return res.status(200).json({
    authenticated: true,
    isOwner,
    user: session.user,
    avatar: session.avatar || null,
  });
}
