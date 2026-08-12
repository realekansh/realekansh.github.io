// Standard Markdown to HTML Renderer matching editor live preview 100%
export function renderMarkdown(md) {
  if (!md) return "";

  let html = md
    .replace(/\r\n/g, "\n")
    // Code blocks with inline styled code panel (Fixes Bug 1: Terminal popup artifact)
    .replace(/```([a-z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<figure class="article-code-block" style="margin-block: 24px; border: 1px solid var(--border); border-radius: var(--radius-md); background: #0d1117; overflow: hidden; position: relative; width: 100%; display: block;"><div style="display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid var(--border);"><span style="width: 9px; height: 9px; border-radius: 50%; background: #ef4444; display: inline-block;"></span><span style="width: 9px; height: 9px; border-radius: 50%; background: #eab308; display: inline-block;"></span><span style="width: 9px; height: 9px; border-radius: 50%; background: #22c55e; display: inline-block;"></span><span style="margin-left: 8px; font-family: 'Fira Code', monospace; font-size: 12px; color: var(--text-muted);">${lang || "code"}</span></div><div style="padding: 16px; overflow-x: auto;"><pre style="margin: 0; font-family: 'Fira Code', monospace; font-size: 13.5px; line-height: 1.6; color: #e2e8f0;"><code>${escapedCode}</code></pre></div></figure>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background: var(--bg-soft); padding: 2px 6px; border-radius: 4px; font-family: \'Fira Code\', monospace; font-size: 0.9em;">$1</code>')
    // Headings
    .replace(/^### (.*$)/gim, '<h3 style="margin-top: 28px; margin-bottom: 12px; font-size: 1.25rem;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h3 style="margin-top: 32px; margin-bottom: 14px; font-size: 1.4rem;">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="margin-top: 36px; margin-bottom: 16px; font-size: 1.75rem;">$1</h2>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent); padding-left: 16px; margin-block: 20px; color: var(--text-muted); font-style: italic;">$1</blockquote>')
    // Horizontal Rule
    .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid var(--border); margin-block: 32px;">')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure style="margin-block: 24px;"><img src="$2" alt="$1" style="width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border); display: block;" loading="lazy"><figcaption style="margin-top: 8px; font-size: var(--fz-xs); color: var(--text-muted); text-align: center;">$1</figcaption></figure>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: underline;">$1</a>')
    // Bold, Italic, Strikethrough
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Task lists
    .replace(/^\s*[\-\*] \[ \] (.*$)/gim, '<li style="margin-bottom: 6px; list-style: none;"><input type="checkbox" disabled style="margin-right: 8px;">$1</li>')
    .replace(/^\s*[\-\*] \[x\] (.*$)/gim, '<li style="margin-bottom: 6px; list-style: none;"><input type="checkbox" checked disabled style="margin-right: 8px;">$1</li>')
    // Unordered lists
    .replace(/^\s*[\-\*] (.*$)/gim, '<li style="margin-bottom: 6px;">$1</li>')
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-bottom: 6px;">$1</li>')
    // Paragraphs
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (
        block.startsWith("<h") ||
        block.startsWith("<figure") ||
        block.startsWith("<blockquote") ||
        block.startsWith("<hr") ||
        block.startsWith("<ul") ||
        block.startsWith("<ol")
      ) {
        return block;
      }
      if (block.startsWith("<li")) {
        return `<ul style="padding-left: 20px; margin-block: 16px;">${block}</ul>`;
      }
      return `<p style="line-height: 1.8; margin-bottom: 20px; color: var(--text); font-size: 1.05rem;">${block}</p>`;
    })
    .join("\n");

  return html;
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const activePostSlug = urlParams.get("post");

  const listView = document.getElementById("blog-list-view");
  const postView = document.getElementById("blog-post-view");

  if (activePostSlug) {
    listView.style.display = "none";
    postView.style.display = "block";
    await loadSinglePost(activePostSlug);
  } else {
    listView.style.display = "block";
    postView.style.display = "none";
    await loadPostList();
  }
});

async function loadPostList() {
  const container = document.getElementById("posts-container");
  const tagFiltersContainer = document.getElementById("tag-filters");

  try {
    let posts = [];
    const res = await fetch("/api/posts/list");
    if (res.ok) {
      posts = await res.json();
    } else {
      const staticRes = await fetch("/posts/index.json");
      if (staticRes.ok) posts = await staticRes.json();
    }

    // Public list ONLY displays published posts (Fixes Bug 5 & 6)
    posts = posts.filter((p) => p.status === "published");

    if (!posts || posts.length === 0) {
      // Fixes Bug 4: Center-aligned empty state card text
      container.innerHTML = `
        <div class="aside-card" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px;">
          <h2 style="text-align: center; margin-bottom: 8px;">No published articles yet</h2>
          <p style="color: var(--text-muted); text-align: center; margin-inline: auto;">Check back soon for technical essays and system notes.</p>
        </div>
      `;
      return;
    }

    const allTags = new Set();
    posts.forEach((p) => (p.tags || []).forEach((t) => allTags.add(t)));

    if (allTags.size > 0) {
      let filterHTML = `<button class="pill active" data-filter="all">All Posts</button>`;
      allTags.forEach((tag) => {
        filterHTML += `<button class="pill" data-filter="${tag}">${tag}</button>`;
      });
      tagFiltersContainer.innerHTML = filterHTML;

      tagFiltersContainer.querySelectorAll(".pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          tagFiltersContainer.querySelectorAll(".pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const selectedTag = btn.getAttribute("data-filter");
          renderCards(selectedTag === "all" ? posts : posts.filter((p) => (p.tags || []).includes(selectedTag)));
        });
      });
    }

    renderCards(posts);
  } catch (err) {
    console.error("Failed to load blog posts:", err);
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Failed to load articles.</p>`;
  }

  function renderCards(postList) {
    container.innerHTML = postList
      .map(
        (post) => `
      <article class="card is-visible" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 20px; border-radius: var(--radius-md); opacity: 1; transform: none;">
        <div>
          ${
            post.cover
              ? `<a href="/blogs/?post=${post.slug}" style="display: block; margin-bottom: 16px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); aspect-ratio: 16 / 9; background: var(--bg-soft);">
                  <img src="${post.cover}" alt="${post.title}" style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease;" loading="lazy">
                 </a>`
              : ""
          }
          <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            ${(post.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <h2 style="font-size: var(--fs-h3); font-weight: var(--fw-bold); margin-bottom: 10px; line-height: var(--lh-snug);">
            <a href="/blogs/?post=${post.slug}" style="color: var(--text); text-decoration: none;">${post.title}</a>
          </h2>
          <p style="color: var(--text-muted); font-size: var(--fs-body); line-height: var(--lh-normal); margin-bottom: 16px;">
            ${post.description || "Read full article..."}
          </p>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-caption); color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 16px; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: var(--fs-caption); font-weight: var(--fw-med);">${post.date} &bull; ${post.readingTime || "3 min read"}</span>
          <a class="button button-outline" href="/blogs/?post=${post.slug}" style="padding: 8px 16px; min-height: 36px; font-size: var(--fs-small);">Read Blog &rarr;</a>
        </div>
      </article>
    `
      )
      .join("");
  }
}

async function loadSinglePost(slug) {
  const titleElem = document.getElementById("post-title");
  const dateElem = document.getElementById("post-date");
  const readingTimeElem = document.getElementById("post-reading-time");
  const authorElem = document.getElementById("post-author");
  const categoryElem = document.getElementById("post-category");
  const bodyContainer = document.getElementById("post-body-container");
  const prevNextContainer = document.getElementById("post-nav-container");

  try {
    let postData = null;
    let allPublished = [];

    const listRes = await fetch("/api/posts/list");
    if (listRes.ok) {
      allPublished = (await listRes.json()).filter((p) => p.status === "published");
    }

    const res = await fetch(`/api/posts/get?slug=${encodeURIComponent(slug)}`);
    if (res.ok) {
      postData = await res.json();
    }

    if (!postData) {
      titleElem.textContent = "Post Not Found";
      bodyContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">The requested post <strong>${slug}</strong> could not be found or is not published.</p>`;
      return;
    }

    const { frontmatter, body } = postData;
    titleElem.textContent = frontmatter.title || slug;
    dateElem.textContent = frontmatter.date || "";
    authorElem.textContent = frontmatter.author || "Ekansh Bhavik";
    categoryElem.textContent = (frontmatter.tags && frontmatter.tags[0]) || "Technical Essay";

    const wordCount = body.split(/\s+/).length;
    readingTimeElem.textContent = Math.max(1, Math.ceil(wordCount / 200)) + " min read";

    document.title = `${frontmatter.title || slug} — Ekansh Bhavik Blog`;

    let html = renderMarkdown(body);
    if (frontmatter.cover) {
      html = `<figure style="margin-bottom: 32px;"><img src="${frontmatter.cover}" alt="${frontmatter.title}" style="width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border);" fetchpriority="high"></figure>` + html;
    }

    // Fixes Bug 3: Bold font and center aligned tags arrangement
    if (frontmatter.tags && frontmatter.tags.length > 0) {
      html += `
        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <strong style="font-weight: var(--fw-bold); font-size: var(--fz-sm); color: var(--text);">Tags:</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            ${frontmatter.tags.map(t => `<span class="pill">${t}</span>`).join("")}
          </div>
        </div>
      `;
    }

    bodyContainer.innerHTML = html;

    // Previous / Next Article Navigation
    if (allPublished.length > 1 && prevNextContainer) {
      const idx = allPublished.findIndex((p) => p.slug === slug);
      let navHTML = '<div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); flex-wrap: wrap;">';

      if (idx < allPublished.length - 1) {
        const prevPost = allPublished[idx + 1];
        navHTML += `<a class="button button-outline button-small" href="/blogs/?post=${prevPost.slug}">&larr; ${prevPost.title}</a>`;
      } else {
        navHTML += '<div></div>';
      }

      if (idx > 0) {
        const nextPost = allPublished[idx - 1];
        navHTML += `<a class="button button-outline button-small" href="/blogs/?post=${nextPost.slug}">${nextPost.title} &rarr;</a>`;
      } else {
        navHTML += '<div></div>';
      }

      navHTML += '</div>';
      prevNextContainer.innerHTML = navHTML;
    }

    // Inject Schema.org JSON-LD Article metadata
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": frontmatter.title,
      "description": frontmatter.description || "",
      "datePublished": frontmatter.date,
      "author": {
        "@type": "Person",
        "name": frontmatter.author || "Ekansh Bhavik",
      },
    });
    document.head.appendChild(script);
  } catch (err) {
    console.error("Error displaying single post:", err);
    titleElem.textContent = "Error Loading Post";
    bodyContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Failed to display article content.</p>`;
  }
}
