import { getAllPosts } from "../_posts.js";
import { verifyAdminSession } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = verifyAdminSession(req);
  const isAuthenticated = Boolean(session);
  const posts = getAllPosts();

  // Non-authenticated visitors ONLY see published posts
  const filteredPosts = isAuthenticated
    ? posts
    : posts.filter((p) => p.status === "published");

  return res.status(200).json(filteredPosts);
}
