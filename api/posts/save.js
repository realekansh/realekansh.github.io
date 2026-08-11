import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { requireAdminAuth } from "../_auth.js";
import { stringifyFrontMatter, updatePostsManifest, commitToGitHub } from "../_posts.js";

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

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Post title is required." });
  }

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ message: "Markdown article content is required." });
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

  let coverUrl = (cover || "").trim();

  const frontmatter = {
    title: title.trim(),
    slug: safeSlug,
    description: (description || "").trim(),
    date: postDate,
    updated: new Date().toISOString().split("T")[0],
    author: "Ekansh Bhavik",
    tags: postTags,
    status: targetStatus,
    cover: coverUrl,
  };

  const fileContent = stringifyFrontMatter(frontmatter, content);

  const relativeFilePath = `posts/${safeSlug}.md`;
  const absoluteFilePath = join(postsDir, `${safeSlug}.md`);

  let localWriteSuccess = false;
  try {
    if (!existsSync(postsDir)) {
      mkdirSync(postsDir, { recursive: true });
    }
    writeFileSync(absoluteFilePath, fileContent, "utf-8");
    updatePostsManifest();
    localWriteSuccess = true;
  } catch (fsErr) {
    console.warn("Serverless local filesystem write skipped (/var/task read-only):", fsErr.message);
  }

  // Commit via GitHub API for permanent production persistence
  let gitCommitSuccess = false;
  if (process.env.GITHUB_TOKEN) {
    try {
      const commitMsg = `feat(blog): ${targetStatus === "draft" ? "save draft" : "publish"} '${title}'`;
      gitCommitSuccess = await commitToGitHub(relativeFilePath, fileContent, commitMsg);
    } catch (gitErr) {
      console.warn("GitHub remote post commit failed:", gitErr.message);
    }
  }

  // If neither local filesystem nor GitHub storage succeeded, return detailed error
  if (!localWriteSuccess && !gitCommitSuccess) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return res.status(500).json({
        message: "Production storage failure: Serverless filesystem is read-only (/var/task) and GITHUB_TOKEN is missing or unauthorized for permanent repository commit.",
      });
    } else {
      return res.status(500).json({
        message: "Failed to save post file to local disk or GitHub repository.",
      });
    }
  }

  return res.status(200).json({
    message: `Post ${targetStatus === "draft" ? "saved as draft" : "published"} successfully!`,
    slug: safeSlug,
    status: targetStatus,
    url: `/blogs/?post=${safeSlug}`,
  });
}
