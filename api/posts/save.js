import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { requireAdminAuth } from "../_auth.js";
import { stringifyFrontMatter, updatePostsManifest, commitToGitHub, parseFrontMatter } from "../_posts.js";

const root = process.cwd();
const postsDir = resolve(root, "posts");

export function generateSlug(title) {
  if (!title) return "untitled-post";
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove unsafe punctuation
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Normalize repeated hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // STRICT SERVER-SIDE ADMIN AUTHENTICATION & AUTHORIZATION GUARD
  const session = requireAdminAuth(req, res);
  if (!session) return; // Response sent by requireAdminAuth (401 or 403)

  const { title, originalSlug, description, date, tags, status, cover, content, action } = req.body || {};

  if (!title || typeof title !== "string" || !content) {
    return res.status(400).json({ message: "Title and content are required." });
  }

  // Slug derivation rule:
  // If editing an existing post with a valid originalSlug, preserve original slug.
  // Otherwise, automatically derive deterministic slug from title.
  let safeSlug = "";
  if (originalSlug && typeof originalSlug === "string" && originalSlug.trim()) {
    safeSlug = originalSlug.trim();
  } else {
    safeSlug = generateSlug(title);
  }

  if (!safeSlug) {
    safeSlug = "post-" + Date.now();
  }

  // Determine publication status based on explicit action or status parameter
  let targetStatus = "draft";
  if (action === "publish" || status === "published") {
    targetStatus = "published";
  }

  const postDate = date || new Date().toISOString().split("T")[0];
  const postTags = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
    ? tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const frontmatter = {
    title: title.trim(),
    slug: safeSlug,
    description: (description || "").trim(),
    date: postDate,
    updated: new Date().toISOString().split("T")[0],
    author: "Ekansh Bhavik",
    tags: postTags,
    status: targetStatus,
    cover: cover || "",
  };

  const fileContent = stringifyFrontMatter(frontmatter, content);

  if (!existsSync(postsDir)) {
    mkdirSync(postsDir, { recursive: true });
  }

  const relativeFilePath = `posts/${safeSlug}.md`;
  const absoluteFilePath = join(postsDir, `${safeSlug}.md`);

  try {
    // Write locally
    writeFileSync(absoluteFilePath, fileContent, "utf-8");
    updatePostsManifest();

    // Commit via GitHub API if GITHUB_TOKEN is available
    if (process.env.GITHUB_TOKEN) {
      const commitMsg = `feat(blog): ${targetStatus === "draft" ? "save draft" : "publish"} '${title}'`;
      await commitToGitHub(relativeFilePath, fileContent, commitMsg);
    }

    return res.status(200).json({
      message: `Post ${targetStatus === "draft" ? "saved as draft" : "published"} successfully!`,
      slug: safeSlug,
      status: targetStatus,
      url: `/blogs/?post=${safeSlug}`,
    });
  } catch (err) {
    console.error("Error saving post:", err);
    return res.status(500).json({ message: "Failed to save post." });
  }
}
