import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseFrontMatter } from "../_posts.js";
import { verifyAdminSession } from "../_auth.js";

const root = process.cwd();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { slug } = req.query || {};
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ message: "Invalid or missing post slug." });
  }

  const filePath = resolve(root, "posts", `${slug}.md`);
  if (!existsSync(filePath)) {
    return res.status(404).json({ message: "Post not found." });
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontMatter(raw);
    const session = verifyAdminSession(req);

    // If post is a draft and user is not admin, hide it
    if (frontmatter.status === "draft" && !session) {
      return res.status(404).json({ message: "Post not found." });
    }

    return res.status(200).json({
      slug,
      frontmatter,
      body,
    });
  } catch (err) {
    console.error("Error reading post:", err);
    return res.status(500).json({ message: "Failed to read post content." });
  }
}
