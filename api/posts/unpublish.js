import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { requireAdminAuth } from "../_auth.js";
import { parseFrontMatter, stringifyFrontMatter, updatePostsManifest } from "../_posts.js";

const root = process.cwd();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = requireAdminAuth(req, res);
  if (!session) return; // 401 or 403

  const { slug } = req.body || req.query || {};
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ message: "Post slug is required." });
  }

  const filePath = resolve(root, "posts", `${slug}.md`);
  if (!existsSync(filePath)) {
    return res.status(404).json({ message: "Post not found." });
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontMatter(raw);
    frontmatter.status = "draft";
    frontmatter.updated = new Date().toISOString().split("T")[0];

    const updatedContent = stringifyFrontMatter(frontmatter, body);
    writeFileSync(filePath, updatedContent, "utf-8");
    updatePostsManifest();

    return res.status(200).json({ message: "Post unpublished and moved to drafts.", slug });
  } catch (err) {
    console.error("Error unpublishing post:", err);
    return res.status(500).json({ message: "Failed to unpublish post." });
  }
}
