// Standard Markdown to HTML Renderer with clean semantic formatting
export function renderMarkdown(md) {
  if (!md) return "";

  let cleaned = md
    .replace(/\r\n/g, "\n")
    // Clean markdown heading alignment / decoration artifacts like :-: or :-
    .replace(/^(#+)\s*[:\-\s]*([^:\-\n]+?)[:\-\s]*$/gim, (match, hashes, text) => {
      const cleanText = text.replace(/^[:\-\s]+|[:\-\s]+$/g, "").trim();
      return `${hashes} ${cleanText}`;
    });

  let html = cleaned
    // Code blocks with code panel container
    .replace(/```([a-z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<figure class="article-code-block"><div class="code-header"><span class="window-dot dot-close"></span><span class="window-dot dot-minimize"></span><span class="window-dot dot-maximize"></span><span class="code-lang">${lang || "code"}</span></div><div class="code-body"><pre><code>${escapedCode}</code></pre></div></figure>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings (Clean H2 and H3 semantics)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal Rule
    .replace(/^---$/gim, '<hr>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure class="article-figure"><img src="$2" alt="$1" loading="lazy"><figcaption>$1</figcaption></figure>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Bold, Italic, Strikethrough
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Task lists
    .replace(/^\s*[\-\*] \[ \] (.*$)/gim, '<li class="task-item"><input type="checkbox" disabled>$1</li>')
    .replace(/^\s*[\-\*] \[x\] (.*$)/gim, '<li class="task-item"><input type="checkbox" checked disabled>$1</li>')
    // Unordered lists
    .replace(/^\s*[\-\*] (.*$)/gim, '<li>$1</li>')
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  let isFirstPara = true;

  html = html
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
        return `<ul>${block}</ul>`;
      }
      if (isFirstPara) {
        isFirstPara = false;
        return `<p class="article-lead">${block}</p>`;
      }
      return `<p>${block}</p>`;
    })
    .join("\n");

  return `<div class="article-content">${html}</div>`;
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
