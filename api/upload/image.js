import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import crypto from "node:crypto";
import { requireAdminAuth } from "../_auth.js";
import { commitToGitHub } from "../_posts.js";

const root = process.cwd();

const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
  ".pdf", ".txt", ".md", ".zip"
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // STRICT SERVER-SIDE ADMIN AUTHENTICATION & AUTHORIZATION GUARD
  const session = requireAdminAuth(req, res);
  if (!session) return; // Returns 401 or 403

  const { filename, base64Data, contentType, postSlug } = req.body || {};

  if (!base64Data) {
    return res.status(400).json({ message: "Missing upload payload (base64Data)." });
  }

  // Infer filename & extension if missing or pasting raw clipboard blobs
  let safeFilename = (filename || "").trim();
  if (!safeFilename) {
    const extFromType = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : contentType === "image/jpeg" ? ".jpg" : ".png";
    safeFilename = `pasted-image-${Date.now()}${extFromType}`;
  }

  let ext = extname(safeFilename).toLowerCase();
  if (!ext || ext === ".") {
    const extFromType = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : contentType === "image/jpeg" ? ".jpg" : ".png";
    ext = extFromType;
    safeFilename += ext;
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({
      message: `Invalid file extension '${ext}'. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
    });
  }

  // Prevent executable extensions explicitly
  if (/\.(php|js|sh|exe|pl|py|cgi|html|htm|jar|bat|cmd)$/i.test(safeFilename)) {
    return res.status(400).json({ message: "Executable and script file uploads are strictly forbidden." });
  }

  // Decode Base64 buffer
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, "base64");
  } catch (err) {
    return res.status(400).json({ message: "Corrupted or invalid Base64 image payload." });
  }

  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ message: "Empty or zero-byte file payload." });
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return res.status(400).json({
      message: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`,
    });
  }

  // Sanitize post slug folder and prevent path traversal
  const safeSlug = (postSlug || "general")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Generate safe randomized filename (OWASP recommendation)
  const uuidName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const targetDir = resolve(root, "assets", "blog", safeSlug);

  // Security Path Traversal Guard
  if (!targetDir.startsWith(resolve(root, "assets", "blog"))) {
    return res.status(400).json({ message: "Invalid asset path target." });
  }

  const targetPath = join(targetDir, uuidName);
  const relativeAssetPath = `/assets/blog/${safeSlug}/${uuidName}`;

  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Write file locally
    writeFileSync(targetPath, buffer);

    // Commit via GitHub API if GITHUB_TOKEN is available (non-blocking)
    if (process.env.GITHUB_TOKEN) {
      try {
        const gitPath = `assets/blog/${safeSlug}/${uuidName}`;
        await commitToGitHub(gitPath, buffer.toString("base64"), `feat(blog): upload attachment ${uuidName}`);
      } catch (gitErr) {
        console.warn("Optional GitHub remote asset sync skipped:", gitErr.message);
      }
    }

    return res.status(200).json({
      message: "File uploaded successfully",
      url: relativeAssetPath,
      filename: uuidName,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ message: `Failed to process file upload: ${err.message}` });
  }
}
