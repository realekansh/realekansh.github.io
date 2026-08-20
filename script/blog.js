/* ============================================================================
   Blog Engine — Markdown Renderer, Post List, Article Reader
   ============================================================================ */

// ─── Markdown Renderer ──────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const isExternal = /^https?:\/\//.test(url);
      return isExternal
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<a href="${url}">${label}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>")
    .replace(/\^([^^]+)\^/g, "<sup>$1</sup>")
    .replace(/~([^~]+)~/g, "<sub>$1</sub>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\[\^(\d+)\]/g, '<sup><a class="footnote-ref" href="#fn-$1" id="fnref-$1">$1</a></sup>');
}

export function renderMarkdown(md, options = {}) {
  if (!md) return "";

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  const footnotes = {};
  let i = 0;

  // Pass 1: Block tokenization
  while (i < lines.length) {
    const line = lines[i];

    // Footnote definitions (collect, don't render inline)
    const fnMatch = line.match(/^\[\^(\d+)\]:\s*(.+)$/);
    if (fnMatch) {
      footnotes[fnMatch[1]] = fnMatch[2];
      i++;
      continue;
    }

    // Fenced code blocks
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const lang = codeMatch[1] || "code";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: "code",
        lang,
        content: codeLines.join("\n"),
      });
      continue;
    }

    // Table (| col | col |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        blocks.push({ type: "table", lines: tableLines });
      }
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/^[:\-\s]+|[:\-\s]+$/g, "").trim();
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // Callout blockquotes: > [!TYPE]
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
    if (calloutMatch) {
      const calloutType = calloutMatch[1].toLowerCase();
      const bodyLines = [];
      i++;
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        bodyLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "callout", calloutType, content: bodyLines.join("\n") });
      continue;
    }

    // Regular blockquotes
    if (line.match(/^>\s?/)) {
      const quoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Standalone image on its own line
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      blocks.push({ type: "figure", alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    // Lists (ordered, unordered, task)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
    if (listMatch) {
      const listLines = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^(\s*)([-*]|\d+\.)\s/);
        if (lm || (lines[i].match(/^\s+/) && listLines.length > 0)) {
          listLines.push(lines[i]);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", lines: listLines });
      continue;
    }

    // Blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect contiguous non-blank lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(#{1,6}\s|```|>|\s*[-*]\s|\s*\d+\.\s|---|\*{3}|_{3}|\|.*\|$|!\[)/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join("<br>") });
    }
  }

  // Pass 2: Render blocks to HTML
  let isFirstPara = true;
  const htmlParts = [];

  for (const block of blocks) {
    switch (block.type) {
      case "code": {
        const escaped = escapeHtml(block.content);
        htmlParts.push(
          `<figure class="article-code-block"><div class="code-header"><span class="window-dot dot-close"></span><span class="window-dot dot-minimize"></span><span class="window-dot dot-maximize"></span><span class="code-lang">${block.lang}</span></div><div class="code-body"><pre><code>${escaped}</code></pre></div></figure>`
        );
        break;
      }

      case "heading": {
        const renderLevel = options.preserveH1 ? block.level : Math.max(2, block.level);
        const id = block.text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        htmlParts.push(`<h${renderLevel} id="${id}">${formatInline(block.text)}</h${renderLevel}>`);
        break;
      }

      case "hr":
        htmlParts.push("<hr>");
        break;

      case "figure":
        htmlParts.push(
          `<figure class="article-figure"><img src="${block.src}" alt="${block.alt}" loading="lazy">${block.alt ? `<figcaption>${block.alt}</figcaption>` : ""}</figure>`
        );
        break;

      case "blockquote":
        htmlParts.push(`<blockquote>${formatInline(block.content)}</blockquote>`);
        break;

      case "callout": {
        const icons = {
          note: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/></svg>',
          tip: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 01-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 00-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.75.75 0 01-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848l.213-.253c.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM5.75 12a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>',
          warning: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575zM8 5a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 008 5zm1 6a1 1 0 11-2 0 1 1 0 012 0z"/></svg>',
          important: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.458 1.458 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25zM8.75 4h-1.5v4h1.5zM8 9.5A1.15 1.15 0 108 11.8 1.15 1.15 0 008 9.5z"/></svg>',
          caution: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.47.22A.749.749 0 015 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 01-.22.53l-4.25 4.25A.749.749 0 0111 16H5a.749.749 0 01-.53-.22L.22 11.53A.749.749 0 010 11V5c0-.199.079-.389.22-.53zM7.25 4v3.25a.75.75 0 001.5 0V4zm.75 6.28a1.22 1.22 0 100 2.44 1.22 1.22 0 000-2.44z"/></svg>',
        };
        const label = block.calloutType.charAt(0).toUpperCase() + block.calloutType.slice(1);
        const rendered = block.content
          .split("\n\n")
          .map((p) => `<p>${formatInline(p.replace(/\n/g, "<br>"))}</p>`)
          .join("");
        htmlParts.push(
          `<div class="callout callout-${block.calloutType}"><div class="callout-label"><span class="callout-icon">${icons[block.calloutType] || ""}</span>${label}</div>${rendered}</div>`
        );
        break;
      }

      case "table": {
        const parseRow = (row) =>
          row
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim());
        const headers = parseRow(block.lines[0]);
        // Skip separator line (line index 1)
        const bodyRows = block.lines.slice(2).map(parseRow);
        let tableHtml = '<div class="article-table-wrap"><table class="article-table"><thead><tr>';
        headers.forEach((h) => (tableHtml += `<th>${formatInline(h)}</th>`));
        tableHtml += "</tr></thead><tbody>";
        bodyRows.forEach((row) => {
          tableHtml += "<tr>";
          row.forEach((cell) => (tableHtml += `<td>${formatInline(cell)}</td>`));
          tableHtml += "</tr>";
        });
        tableHtml += "</tbody></table></div>";
        htmlParts.push(tableHtml);
        break;
      }

      case "list": {
        htmlParts.push(renderList(block.lines));
        break;
      }

      case "paragraph": {
        const formatted = formatInline(block.content);
        if (isFirstPara && !options.noLead) {
          isFirstPara = false;
          htmlParts.push(`<p class="article-lead">${formatted}</p>`);
        } else {
          htmlParts.push(`<p>${formatted}</p>`);
        }
        break;
      }
    }
  }

  // Render footnotes
  const fnKeys = Object.keys(footnotes);
  if (fnKeys.length > 0) {
    let fnHtml = '<section class="article-footnotes"><p class="article-footnotes-title">Footnotes</p><ol>';
    fnKeys.forEach((key) => {
      fnHtml += `<li id="fn-${key}">${formatInline(footnotes[key])} <a href="#fnref-${key}" class="footnote-backref">↩</a></li>`;
    });
    fnHtml += "</ol></section>";
    htmlParts.push(fnHtml);
  }

  return `<div class="article-content">${htmlParts.join("\n")}</div>`;
}

function renderList(listLines) {
  const items = [];
  let currentIndent = -1;

  for (const line of listLines) {
    const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
    if (!match) continue;

    const indent = match[1].length;
    const marker = match[2];
    let text = match[3];
    let isTask = false;
    let isChecked = false;

    // Task list detection
    const taskMatch = text.match(/^\[([ xX])\]\s*(.*)/);
    if (taskMatch) {
      isTask = true;
      isChecked = taskMatch[1].toLowerCase() === "x";
      text = taskMatch[2];
    }

    const isOrdered = /^\d+\.$/.test(marker);
    items.push({ indent, text, isOrdered, isTask, isChecked });
  }

  if (items.length === 0) return "";

  // Simple flat rendering with task list support
  const hasTaskItems = items.some((it) => it.isTask);
  const isOrdered = items[0].isOrdered && !hasTaskItems;

  if (hasTaskItems) {
    return `<ul class="task-list">${items
      .map(
        (it) =>
          `<li>${it.isTask ? `<input type="checkbox"${it.isChecked ? " checked" : ""} disabled>` : ""}${formatInline(it.text)}</li>`
      )
      .join("")}</ul>`;
  }

  const tag = isOrdered ? "ol" : "ul";
  return `<${tag}>${items.map((it) => `<li>${formatInline(it.text)}</li>`).join("")}</${tag}>`;
}

// ─── Post List View ─────────────────────────────────────────────────────────

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const activePostSlug = urlParams.get("post");

    const listView = document.getElementById("blog-list-view");
    const postView = document.getElementById("blog-post-view");

    if (activePostSlug) {
      if (listView) listView.style.display = "none";
      if (postView) postView.style.display = "block";
      await loadSinglePost(activePostSlug);
    } else {
      if (listView) listView.style.display = "block";
      if (postView) postView.style.display = "none";
      await loadPostList();
    }
  });
}

async function loadPostList() {
  const container = document.getElementById("posts-container");
  const featuredContainer = document.getElementById("featured-container");
  const tagFiltersContainer = document.getElementById("tag-filters");
  const searchInput = document.getElementById("blog-search-input");
  const searchWrap = document.getElementById("blog-search");
  const searchClear = document.getElementById("blog-search-clear");
  const loadingEl = document.getElementById("blog-loading");
  const emptyEl = document.getElementById("blog-empty");
  const errorEl = document.getElementById("blog-error");

  let allPosts = [];
  let currentTag = "all";
  let currentSearch = "";

  // Show loading state
  if (loadingEl) loadingEl.style.display = "grid";
  if (container) container.style.display = "none";
  if (featuredContainer) featuredContainer.style.display = "none";
  if (emptyEl) emptyEl.style.display = "none";
  if (errorEl) errorEl.style.display = "none";

  try {
    let posts = [];
    const res = await fetch("/api/posts/list");
    if (res.ok) {
      posts = await res.json();
    } else {
      const staticRes = await fetch("/posts/index.json");
      if (staticRes.ok) posts = await staticRes.json();
    }

    allPosts = posts.filter((p) => p.status === "published");

    if (loadingEl) loadingEl.style.display = "none";

    // Build tag filters
    const allTags = new Set();
    allPosts.forEach((p) => (p.tags || []).forEach((t) => allTags.add(t)));

    if (allTags.size > 0 && tagFiltersContainer) {
      let filterHTML = `<button class="pill is-active" data-filter="all" aria-pressed="true">All</button>`;
      allTags.forEach((tag) => {
        filterHTML += `<button class="pill" data-filter="${tag}" aria-pressed="false">${tag}</button>`;
      });
      tagFiltersContainer.innerHTML = filterHTML;

      tagFiltersContainer.querySelectorAll(".pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          tagFiltersContainer.querySelectorAll(".pill").forEach((b) => {
            b.classList.remove("is-active");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("is-active");
          btn.setAttribute("aria-pressed", "true");
          currentTag = btn.getAttribute("data-filter");
          applyFilters();
        });
      });
    }

    // Search functionality
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentSearch = searchInput.value.trim().toLowerCase();
        if (searchWrap) searchWrap.classList.toggle("has-value", currentSearch.length > 0);
        applyFilters();
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          searchInput.value = "";
          currentSearch = "";
          if (searchWrap) searchWrap.classList.remove("has-value");
          applyFilters();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        currentSearch = "";
        if (searchWrap) searchWrap.classList.remove("has-value");
        applyFilters();
      });
    }

    applyFilters();
  } catch (err) {
    console.error("Failed to load blog posts:", err);
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) errorEl.style.display = "block";

    const retryBtn = document.getElementById("blog-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => loadPostList(), { once: true });
    }
  }

  function applyFilters() {
    let filtered = allPosts;

    if (currentTag !== "all") {
      filtered = filtered.filter((p) => (p.tags || []).includes(currentTag));
    }

    if (currentSearch) {
      filtered = filtered.filter((p) => {
        const haystack = `${p.title} ${p.description || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
        return haystack.includes(currentSearch);
      });
    }

    renderPosts(filtered);
  }

  function renderPosts(posts) {
    const isSearchActive = currentSearch.length > 0;

    if (posts.length === 0) {
      if (container) container.style.display = "none";
      if (emptyEl) {
        emptyEl.style.display = "block";
        const emptyTitle = emptyEl.querySelector(".blog-empty-title");
        const emptyDesc = emptyEl.querySelector(".blog-empty-desc");
        const clearBtn = emptyEl.querySelector(".blog-empty-clear");
        if (isSearchActive || currentTag !== "all") {
          if (emptyTitle) emptyTitle.textContent = "No articles match your search";
          if (emptyDesc) emptyDesc.textContent = "Try a different search term or browse all articles.";
          if (clearBtn) clearBtn.style.display = "inline-flex";
        } else {
          if (emptyTitle) emptyTitle.textContent = "No published articles yet";
          if (emptyDesc) emptyDesc.textContent = "Check back soon for technical essays and system notes.";
          if (clearBtn) clearBtn.style.display = "none";
        }
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (container) {
      container.style.display = "grid";
      container.innerHTML = posts.map((post) => renderCard(post)).join("");
    }
  }

  function renderCard(post) {
    const tags = (post.tags || []).slice(0, 3);
    const extraCount = (post.tags || []).length - 3;
    const tagsHtml = tags.map((t) => `<span class="tag">${t}</span>`).join("") +
      (extraCount > 0 ? `<span class="tag">+${extraCount}</span>` : "");

    return `<a class="blog-card" href="/blogs/?post=${post.slug}">
      ${post.cover ? `<div class="blog-card-image"><img src="${post.cover}" alt="${post.title}" loading="lazy"></div>` : ""}
      <div class="blog-card-body">
        ${tagsHtml ? `<div class="blog-card-tags">${tagsHtml}</div>` : ""}
        <h2 class="blog-card-title">${post.title}</h2>
        ${post.description ? `<p class="blog-card-desc">${post.description}</p>` : ""}
        <div class="blog-card-footer">
          <div class="blog-card-meta">
            <span>${post.date || ""}</span>
            ${post.date && post.readingTime ? '<span class="sep">&middot;</span>' : ""}
            <span>${post.readingTime || ""}</span>
          </div>
          <span class="blog-card-action">Read Blog &rarr;</span>
        </div>
      </div>
    </a>`;
  }
}

// ─── Single Post View ───────────────────────────────────────────────────────

async function loadSinglePost(slug) {
  const titleElem = document.getElementById("post-title");
  const metaContainer = document.getElementById("post-meta-container");
  const tagsContainer = document.getElementById("post-tags-container");
  const bodyContainer = document.getElementById("post-body-container");
  const coverContainer = document.getElementById("post-cover-container");
  const prevNextContainer = document.getElementById("post-nav-container");
  const tocContainer = document.getElementById("post-toc");

  try {
    let allPublished = [];

    const listRes = await fetch("/api/posts/list");
    if (listRes.ok) {
      allPublished = (await listRes.json()).filter((p) => p.status === "published");
    }

    const res = await fetch(`/api/posts/get?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) {
      if (titleElem) titleElem.textContent = "Post Not Found";
      if (bodyContainer) bodyContainer.innerHTML = `<div class="blog-empty"><p class="blog-empty-title">Article not found</p><p class="blog-empty-desc">The requested article could not be found or is not published.</p><a class="button button-outline" href="/blogs/">← Back to Blog</a></div>`;
      return;
    }

    const postData = await res.json();
    const { frontmatter, body } = postData;

    // Title
    if (titleElem) titleElem.textContent = frontmatter.title || slug;

    // Metadata
    const wordCount = body.split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    if (metaContainer) {
      metaContainer.innerHTML = `
        <span>${frontmatter.date || ""}</span>
        <span class="meta-dot">&bull;</span>
        <span>${frontmatter.author || "Ekansh Bhavik"}</span>
        <span class="meta-dot">&bull;</span>
        <span>${readTime} min read</span>
      `;
    }

    // Tags
    if (tagsContainer && frontmatter.tags && frontmatter.tags.length > 0) {
      tagsContainer.innerHTML = frontmatter.tags.map((t) => `<span class="tag">${t}</span>`).join("");
      tagsContainer.style.display = "flex";
    }

    // Cover image
    if (coverContainer && frontmatter.cover) {
      coverContainer.innerHTML = `<img src="${frontmatter.cover}" alt="${frontmatter.title}" fetchpriority="high">`;
      coverContainer.style.display = "block";
    }

    // Page title
    document.title = `${frontmatter.title || slug} — Ekansh Bhavik Blog`;

    // Render body
    const renderedHtml = renderMarkdown(body);
    if (bodyContainer) bodyContainer.innerHTML = renderedHtml;

    // Table of contents
    if (tocContainer) {
      buildTableOfContents(bodyContainer, tocContainer);
    }

    // Previous / Next navigation
    if (allPublished.length > 1 && prevNextContainer) {
      const idx = allPublished.findIndex((p) => p.slug === slug);
      let navHTML = '<nav class="post-nav">';

      if (idx < allPublished.length - 1) {
        const prevPost = allPublished[idx + 1];
        navHTML += `<a class="post-nav-link" href="/blogs/?post=${prevPost.slug}"><span class="post-nav-label">← Previous</span><span class="post-nav-title">${prevPost.title}</span></a>`;
      } else {
        navHTML += "<div></div>";
      }

      if (idx > 0) {
        const nextPost = allPublished[idx - 1];
        navHTML += `<a class="post-nav-link post-nav-link--next" href="/blogs/?post=${nextPost.slug}"><span class="post-nav-label">Next →</span><span class="post-nav-title">${nextPost.title}</span></a>`;
      } else {
        navHTML += "<div></div>";
      }

      navHTML += "</nav>";
      prevNextContainer.innerHTML = navHTML;
    }

    // Schema.org JSON-LD
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: frontmatter.title,
      description: frontmatter.description || "",
      datePublished: frontmatter.date,
      dateModified: frontmatter.updated || frontmatter.date,
      image: frontmatter.cover || "",
      author: {
        "@type": "Person",
        name: frontmatter.author || "Ekansh Bhavik",
      },
      wordCount: wordCount,
    });
    document.head.appendChild(script);
  } catch (err) {
    console.error("Error displaying single post:", err);
    if (titleElem) titleElem.textContent = "Error Loading Post";
    if (bodyContainer) bodyContainer.innerHTML = `<div class="blog-error"><p class="blog-error-title">Something went wrong</p><p class="blog-error-desc">Unable to load article content. Please try again.</p><a class="button button-outline" href="/blogs/">← Back to Blog</a></div>`;
  }
}

// ─── Table of Contents ──────────────────────────────────────────────────────

function buildTableOfContents(contentEl, tocEl) {
  if (!contentEl || !tocEl) return;

  const headings = contentEl.querySelectorAll("h2, h3, h4");
  if (headings.length < 3) {
    tocEl.style.display = "none";
    return;
  }

  let tocHtml = '<p class="article-toc-title">On this page</p><nav class="article-toc-list">';
  headings.forEach((h) => {
    const level = parseInt(h.tagName.charAt(1));
    const id = h.id || h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!h.id) h.id = id;
    tocHtml += `<a class="article-toc-link" data-level="${level}" href="#${id}">${h.textContent}</a>`;
  });
  tocHtml += "</nav>";
  tocEl.innerHTML = tocHtml;
  tocEl.style.display = "block";

  // Scroll tracking with IntersectionObserver
  const links = tocEl.querySelectorAll(".article-toc-link");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("is-active"));
          const activeLink = tocEl.querySelector(`a[href="#${entry.target.id}"]`);
          if (activeLink) activeLink.classList.add("is-active");
        }
      });
    },
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
  );

  headings.forEach((h) => observer.observe(h));
}
