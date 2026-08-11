import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const postsDir = resolve(root, "posts");

export function ensurePostsDir() {
  if (!existsSync(postsDir)) {
    mkdirSync(postsDir, { recursive: true });
  }
}

export function parseFrontMatter(fileContent) {
  if (!fileContent.startsWith("---")) {
    return { frontmatter: {}, body: fileContent };
  }

  const endIndex = fileContent.indexOf("---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: fileContent };
  }

  const yamlBlock = fileContent.slice(3, endIndex).trim();
  const body = fileContent.slice(endIndex + 3).trim();
  const frontmatter = {};

  yamlBlock.split(/\r?\n/).forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Unquote strings
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else if (value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch (e) {
          value = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
        }
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      }

      frontmatter[key] = value;
    }
  });

  return { frontmatter, body };
}

export function stringifyFrontMatter(frontmatter, body) {
  let yaml = "---\n";
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      yaml += `${key}: ${JSON.stringify(val)}\n`;
    } else if (typeof val === "boolean" || typeof val === "number") {
      yaml += `${key}: ${val}\n`;
    } else {
      yaml += `${key}: "${String(val).replace(/"/g, '\\"')}"\n`;
    }
  }
  yaml += "---\n\n";
  yaml += body.trim() + "\n";
  return yaml;
}

export function getAllPosts() {
  ensurePostsDir();
  const files = readdirSync(postsDir).filter((file) => file.endsWith(".md"));
  const posts = [];

  for (const file of files) {
    try {
      const fullPath = join(postsDir, file);
      const raw = readFileSync(fullPath, "utf-8");
      const { frontmatter, body } = parseFrontMatter(raw);
      const slug = frontmatter.slug || file.replace(/\.md$/, "");

      posts.push({
        slug,
        title: frontmatter.title || slug,
        description: frontmatter.description || "",
        date: frontmatter.date || new Date().toISOString().split("T")[0],
        updated: frontmatter.updated || frontmatter.date || "",
        author: frontmatter.author || "Ekansh Bhavik",
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        status: frontmatter.status || "published",
        cover: frontmatter.cover || "",
        readingTime: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)) + " min read",
      });
    } catch (err) {
      console.warn(`Failed to parse post ${file}:`, err.message);
    }
  }

  // Sort by date descending
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function generateRSSFeed(posts) {
  const publishedPosts = posts.filter((p) => p.status === "published");
  const itemsXML = publishedPosts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>https://realekansh.xyz/blogs/?post=${p.slug}</link>
      <guid isPermaLink="true">https://realekansh.xyz/blogs/?post=${p.slug}</guid>
      <description><![CDATA[${p.description || p.title}]]></description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <author>Ekansh Bhavik</author>
    </item>`
    )
    .join("\n");

  const rssXML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/assets/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ekansh Bhavik Blog</title>
    <link>https://realekansh.xyz/blogs/</link>
    <description>Technical essays, system architecture notes, open-source tooling, and Linux workflow insights by Ekansh Bhavik.</description>
    <language>en-us</language>
    <atom:link href="https://realekansh.xyz/feed.xml" rel="self" type="application/rss+xml"/>
${itemsXML}
  </channel>
</rss>`;

  const feedPath = resolve(root, "feed.xml");
  writeFileSync(feedPath, rssXML, "utf-8");
}

export function generateSitemap(posts) {
  const publishedPosts = posts.filter((p) => p.status === "published");
  const baseUrls = [
    "https://realekansh.xyz/",
    "https://realekansh.xyz/about/",
    "https://realekansh.xyz/projects/",
    "https://realekansh.xyz/projects/hypercore/",
    "https://realekansh.xyz/projects/hyprland-rice/",
    "https://realekansh.xyz/projects/post-management-bot/",
    "https://realekansh.xyz/projects/shell-bot/",
    "https://realekansh.xyz/projects/downloader-bot/",
    "https://realekansh.xyz/projects/file-organizer/",
    "https://realekansh.xyz/communities/",
    "https://realekansh.xyz/blogs/",
    "https://realekansh.xyz/contact/",
  ];

  const postUrls = publishedPosts.map((p) => `https://realekansh.xyz/blogs/?post=${p.slug}`);

  const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${baseUrls.concat(postUrls).map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

  const sitemapPath = resolve(root, "sitemap.xml");
  writeFileSync(sitemapPath, sitemapXML, "utf-8");
}

export function updatePostsManifest() {
  ensurePostsDir();
  const posts = getAllPosts();
  const manifestPath = join(postsDir, "index.json");
  writeFileSync(manifestPath, JSON.stringify(posts, null, 2), "utf-8");
  
  // Regenerate RSS Feed and Sitemap automatically for published posts
  generateRSSFeed(posts);
  generateSitemap(posts);

  return posts;
}

export async function commitToGitHub(filePath, content, commitMessage) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "realekansh";
  const repo = process.env.GITHUB_REPO || "realekansh.github.io";

  if (!token) return false;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  let sha = null;

  try {
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "realekansh-portfolio-blog",
      },
    });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }
  } catch (e) {}

  const bodyData = {
    message: commitMessage,
    content: Buffer.from(content).toString("base64"),
    branch: "main",
  };
  if (sha) bodyData.sha = sha;

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "realekansh-portfolio-blog",
    },
    body: JSON.stringify(bodyData),
  });

  return putRes.ok;
}
