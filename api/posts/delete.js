import { unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { requireAdminAuth } from "../_auth.js";
import { updatePostsManifest } from "../_posts.js";

const root = process.cwd();

export default async function handler(req, res) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // STRICT SERVER-SIDE ADMIN AUTHENTICATION & AUTHORIZATION GUARD
  const session = requireAdminAuth(req, res);
  if (!session) return; // Returns 401 or 403

  const { slug } = req.body || req.query || {};
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ message: "Invalid or missing post slug." });
  }

  const filePath = resolve(root, "posts", `${slug}.md`);

  if (!existsSync(filePath)) {
    return res.status(404).json({ message: "Post not found." });
  }

  try {
    unlinkSync(filePath);
    updatePostsManifest();
    return res.status(200).json({ message: "Post deleted successfully." });
  } catch (err) {
    console.error("Error deleting post:", err);
    return res.status(500).json({ message: "Failed to delete post." });
  }
}
