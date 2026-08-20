/* ============================================================================
   Editor — Writing Workspace Logic
   ============================================================================ */

import { renderMarkdown } from "/script/blog.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ─── Auth Gate ────────────────────────────────────────────────────────
  const authRes = await fetch("/api/auth/user");
  const authData = await authRes.json();
  if (!authData.authenticated || !authData.isOwner) {
    window.location.href = "/admin/";
    return;
  }

  // ─── DOM References ───────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const editSlug = urlParams.get("edit");

  const titleInput = document.getElementById("editor-title");
  const descInput = document.getElementById("editor-desc");
  const slugPreview = document.getElementById("editor-slug");
  const markdownInput = document.getElementById("editor-textarea");
  const previewContent = document.getElementById("editor-preview-content");
  const canvas = document.getElementById("editor-canvas");
  const wordCount = document.getElementById("editor-word-count");

  const dateInput = document.getElementById("editor-date");
  const tagsInput = document.getElementById("editor-tags-input");
  const tagsListEl = document.getElementById("editor-tags-list");
  const coverInput = document.getElementById("editor-cover-url");
  const coverPreview = document.getElementById("editor-cover-preview");
  const imageFileInput = document.getElementById("editor-image-upload");

  const statusBadge = document.getElementById("editor-status-badge");
  const autosaveEl = document.getElementById("editor-autosave");
  const publishBtn = document.getElementById("editor-publish");
  const publishBtnText = document.getElementById("editor-publish-text");
  const previewToggle = document.getElementById("editor-preview-toggle");
  const previewToggleText = document.getElementById("editor-preview-text");
  const sidebarToggle = document.getElementById("editor-sidebar-toggle");
  const sidebar = document.getElementById("editor-sidebar");
  const sidebarBackdrop = document.getElementById("editor-sidebar-backdrop");
  const outlineList = document.getElementById("editor-outline-list");
  const headingLabel = document.getElementById("editor-heading");

  let originalSlug = editSlug || "";
  let currentStatus = "draft";
  let currentTags = [];
  let autosaveTimer = null;
  let isPreviewMode = false;

  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

  // ─── Slug Generation ─────────────────────────────────────────────────
  function generateSlug(title) {
    if (!title) return "untitled-post";
    return title
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // ─── Title / Slug ────────────────────────────────────────────────────
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      if (!originalSlug && slugPreview) {
        slugPreview.textContent = `/blogs/?post=${generateSlug(titleInput.value)}`;
      }
      autoResize(titleInput);
      scheduleAutosave();
      updatePreview();
    });
  }

  if (descInput) {
    descInput.addEventListener("input", () => {
      autoResize(descInput);
      scheduleAutosave();
    });
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // ─── Markdown Input ──────────────────────────────────────────────────
  if (markdownInput) {
    markdownInput.addEventListener("input", () => {
      updatePreview();
      updateWordCount();
      updateOutline();
      scheduleAutosave();
    });

    // Auto-list continuation on Enter
    markdownInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const pos = markdownInput.selectionStart;
        const val = markdownInput.value;
        const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
        const currentLine = val.substring(lineStart, pos);

        const taskMatch = currentLine.match(/^(\s*[-*]\s+\[[\s\x]\]\s+)/);
        const bulletMatch = currentLine.match(/^(\s*[-*]\s+)/);
        const numberMatch = currentLine.match(/^(\s*(\d+)\.\s+)/);

        // If line is empty list item, remove it instead of continuing
        if (taskMatch && currentLine.trim() === "- [ ]") {
          e.preventDefault();
          markdownInput.value = val.slice(0, lineStart) + "\n" + val.slice(pos);
          markdownInput.selectionStart = markdownInput.selectionEnd = lineStart + 1;
          updatePreview();
          return;
        }

        if (taskMatch) {
          e.preventDefault();
          insertAtCursor("\n- [ ] ");
        } else if (bulletMatch && currentLine.trim() !== "-" && currentLine.trim() !== "*") {
          e.preventDefault();
          insertAtCursor("\n" + bulletMatch[1]);
        } else if (numberMatch && currentLine.trim() !== "1.") {
          e.preventDefault();
          const nextNum = parseInt(numberMatch[2], 10) + 1;
          insertAtCursor(`\n${nextNum}. `);
        }
      }

      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "b") { e.preventDefault(); applyFormat("bold"); }
        else if (key === "i") { e.preventDefault(); applyFormat("italic"); }
        else if (key === "k") {
          e.preventDefault();
          if (e.shiftKey) applyFormat("code");
          else applyFormat("link");
        }
        else if (key === "s") { e.preventDefault(); saveArticle("draft"); }
        else if (key === "p" && e.shiftKey) { e.preventDefault(); togglePreview(); }
      }

      // Slash commands
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const pos = markdownInput.selectionStart;
        const val = markdownInput.value;
        const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
        const lineContent = val.substring(lineStart, pos);
        if (lineContent.trim() === "") {
          openSlashMenu();
        }
      }

      if (e.key === "Escape") {
        closeSlashMenu();
      }
    });
  }

  // ─── Slash Command Menu ──────────────────────────────────────────────
  const slashMenu = document.getElementById("slash-menu");
  const slashCommands = [
    { cmd: "h1", label: "Heading 1", hint: "# ", icon: "H1" },
    { cmd: "h2", label: "Heading 2", hint: "## ", icon: "H2" },
    { cmd: "h3", label: "Heading 3", hint: "### ", icon: "H3" },
    { cmd: "code", label: "Code Block", hint: "```", icon: "{}" },
    { cmd: "quote", label: "Blockquote", hint: "> ", icon: "❝" },
    { cmd: "table", label: "Table", hint: "| |", icon: "⊞" },
    { cmd: "image", label: "Image", hint: "![]()", icon: "📷" },
    { cmd: "divider", label: "Divider", hint: "---", icon: "—" },
    { cmd: "checklist", label: "Checklist", hint: "- [ ]", icon: "☑" },
    { cmd: "callout", label: "Callout", hint: "> [!NOTE]", icon: "ℹ" },
    { cmd: "footnote", label: "Footnote", hint: "[^1]", icon: "¹" },
  ];
  let slashFocusIndex = 0;
  let slashFilter = "";

  function openSlashMenu() {
    if (!slashMenu) return;
    slashFilter = "";
    slashFocusIndex = 0;
    renderSlashMenu();
    slashMenu.classList.add("is-open");

    // Position near cursor
    const rect = markdownInput.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(markdownInput).lineHeight) || 24;
    const lines = markdownInput.value.substring(0, markdownInput.selectionStart).split("\n").length;
    const top = Math.min(rect.top + lines * lineHeight + 4, window.innerHeight - 300);
    slashMenu.style.top = top + "px";
    slashMenu.style.left = rect.left + 20 + "px";
  }

  function closeSlashMenu() {
    if (slashMenu) slashMenu.classList.remove("is-open");
  }

  function renderSlashMenu() {
    if (!slashMenu) return;
    const filtered = slashCommands.filter((c) =>
      c.cmd.includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)
    );
    if (filtered.length === 0) {
      slashMenu.innerHTML = '<div class="slash-menu-empty">No commands found</div>';
      return;
    }
    slashMenu.innerHTML = filtered
      .map(
        (c, i) =>
          `<div class="slash-menu-item${i === slashFocusIndex ? " is-focused" : ""}" data-cmd="${c.cmd}"><span class="slash-menu-item-icon">${c.icon}</span><span class="slash-menu-item-label">${c.label}</span><span class="slash-menu-item-hint">${c.hint}</span></div>`
      )
      .join("");

    slashMenu.querySelectorAll(".slash-menu-item").forEach((item) => {
      item.addEventListener("click", () => executeSlashCommand(item.dataset.cmd));
    });
  }

  function executeSlashCommand(cmd) {
    closeSlashMenu();
    // Remove the "/" that was typed
    const pos = markdownInput.selectionStart;
    const val = markdownInput.value;
    const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
    markdownInput.value = val.slice(0, lineStart) + val.slice(pos);
    markdownInput.selectionStart = markdownInput.selectionEnd = lineStart;

    const templates = {
      h1: "# ",
      h2: "## ",
      h3: "### ",
      code: "```javascript\n\n```",
      quote: "> ",
      table: "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |",
      image: "![Alt text](url)",
      divider: "---",
      checklist: "- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3",
      callout: "> [!NOTE]\n> Your note text here",
      footnote: "Text with reference[^1]\n\n[^1]: Footnote content",
    };

    if (templates[cmd]) {
      insertAtCursor(templates[cmd]);
    }

    if (cmd === "image" && imageFileInput) {
      imageFileInput.click();
    }

    updatePreview();
    updateOutline();
  }

  // ─── Formatting ──────────────────────────────────────────────────────
  document.querySelectorAll("[data-fmt]").forEach((btn) => {
    btn.addEventListener("click", () => applyFormat(btn.dataset.fmt));
  });

  function applyFormat(type) {
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const text = markdownInput.value;
    const selected = text.slice(start, end);
    let inserted = "";

    switch (type) {
      case "bold": inserted = `**${selected || "bold text"}**`; break;
      case "italic": inserted = `*${selected || "italic text"}*`; break;
      case "underline": inserted = `__${selected || "underlined text"}__`; break;
      case "strike": inserted = `~~${selected || "strikethrough"}~~`; break;
      case "h1": inserted = `\n# ${selected || "Heading 1"}\n`; break;
      case "h2": inserted = `\n## ${selected || "Heading 2"}\n`; break;
      case "h3": inserted = `\n### ${selected || "Heading 3"}\n`; break;
      case "bullet": inserted = `\n- ${selected || "List item"}\n`; break;
      case "number": inserted = `\n1. ${selected || "List item"}\n`; break;
      case "task": inserted = `\n- [ ] ${selected || "Task item"}\n`; break;
      case "quote": inserted = `\n> ${selected || "Quote"}\n`; break;
      case "code": inserted = `\`${selected || "code"}\``; break;
      case "codeblock": inserted = `\n\`\`\`javascript\n${selected || "// code"}\n\`\`\`\n`; break;
      case "hr": inserted = `\n---\n`; break;
      case "link":
        const url = prompt("Enter URL:", "https://");
        if (url) inserted = `[${selected || "Link text"}](${url})`;
        else return;
        break;
      case "image":
        if (imageFileInput) imageFileInput.click();
        return;
    }

    markdownInput.value = text.slice(0, start) + inserted + text.slice(end);
    markdownInput.focus();
    markdownInput.selectionStart = start;
    markdownInput.selectionEnd = start + inserted.length;
    updatePreview();
    updateWordCount();
    updateOutline();
    scheduleAutosave();
  }

  function insertAtCursor(text) {
    const pos = markdownInput.selectionStart;
    const val = markdownInput.value;
    markdownInput.value = val.slice(0, pos) + text + val.slice(pos);
    markdownInput.selectionStart = markdownInput.selectionEnd = pos + text.length;
    markdownInput.focus();
    updatePreview();
    updateWordCount();
  }

  // ─── Preview ─────────────────────────────────────────────────────────
  function updatePreview() {
    if (!previewContent || !markdownInput) return;
    const md = markdownInput.value;
    if (md.trim()) {
      previewContent.innerHTML = renderMarkdown(md, { preserveH1: true });
    } else {
      previewContent.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Preview will appear as you type...</p>';
    }
  }

  function togglePreview() {
    isPreviewMode = !isPreviewMode;
    if (canvas) canvas.classList.toggle("is-preview", isPreviewMode);
    if (previewToggleText) previewToggleText.textContent = isPreviewMode ? "Edit" : "Preview";
    if (isPreviewMode) updatePreview();
  }

  if (previewToggle) {
    previewToggle.addEventListener("click", togglePreview);
  }

  // ─── Word Count ──────────────────────────────────────────────────────
  function updateWordCount() {
    if (!wordCount || !markdownInput) return;
    const text = markdownInput.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    const readTime = Math.max(1, Math.ceil(count / 200));
    wordCount.textContent = `${count} words · ${readTime} min read`;
  }

  // ─── Document Outline ────────────────────────────────────────────────
  let outlineTimeout;
  function updateOutline() {
    clearTimeout(outlineTimeout);
    outlineTimeout = setTimeout(() => {
      if (!outlineList || !markdownInput) return;
      const lines = markdownInput.value.split("\n");
      const headings = [];
      lines.forEach((line, idx) => {
        const match = line.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
          headings.push({ level: match[1].length, text: match[2], line: idx });
        }
      });

      if (headings.length === 0) {
        outlineList.innerHTML = '<span style="color: var(--text-muted); font-size: var(--fs-caption);">No headings yet</span>';
        return;
      }

      outlineList.innerHTML = headings
        .map(
          (h) =>
            `<a class="editor-outline-link" data-level="${h.level}" data-line="${h.line}">${h.text}</a>`
        )
        .join("");

      outlineList.querySelectorAll(".editor-outline-link").forEach((link) => {
        link.addEventListener("click", () => {
          const lineIdx = parseInt(link.dataset.line);
          scrollTextareaToLine(lineIdx);
        });
      });
    }, 500);
  }

  function scrollTextareaToLine(lineIdx) {
    if (!markdownInput) return;
    const lines = markdownInput.value.split("\n");
    let pos = 0;
    for (let i = 0; i < lineIdx && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    markdownInput.focus();
    markdownInput.selectionStart = markdownInput.selectionEnd = pos;
    // Estimate scroll position
    const lineHeight = parseFloat(getComputedStyle(markdownInput).lineHeight) || 24;
    markdownInput.scrollTop = lineIdx * lineHeight - markdownInput.clientHeight / 3;
  }

  // ─── Tags ────────────────────────────────────────────────────────────
  function renderTags() {
    if (!tagsListEl) return;
    tagsListEl.innerHTML = currentTags
      .map(
        (tag, i) =>
          `<span class="editor-tag-chip">${tag}<button class="editor-tag-remove" data-idx="${i}" aria-label="Remove ${tag}">×</button></span>`
      )
      .join("");
    tagsListEl.querySelectorAll(".editor-tag-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTags.splice(parseInt(btn.dataset.idx), 1);
        renderTags();
        scheduleAutosave();
      });
    });
  }

  if (tagsInput) {
    tagsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const tag = tagsInput.value.trim().replace(/,/g, "");
        if (tag && !currentTags.includes(tag)) {
          currentTags.push(tag);
          renderTags();
          scheduleAutosave();
        }
        tagsInput.value = "";
      }
    });
  }

  // ─── Cover Image ─────────────────────────────────────────────────────
  if (coverInput) {
    coverInput.addEventListener("input", () => {
      updateCoverPreview();
      scheduleAutosave();
    });
  }

  function updateCoverPreview() {
    if (!coverPreview || !coverInput) return;
    if (coverInput.value.trim()) {
      coverPreview.innerHTML = `<img src="${coverInput.value}" alt="Cover preview">`;
    } else {
      coverPreview.innerHTML = '<span class="editor-cover-empty">No cover image</span>';
    }
  }

  // ─── Sidebar Toggle (Mobile) ─────────────────────────────────────────
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("is-open");
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle("is-visible");
    });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      if (sidebar) sidebar.classList.remove("is-open");
      sidebarBackdrop.classList.remove("is-visible");
    });
  }

  // Collapsible sidebar sections
  document.querySelectorAll(".editor-section-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.parentElement.classList.toggle("is-collapsed");
    });
  });

  // ─── File Upload ─────────────────────────────────────────────────────
  if (markdownInput) {
    markdownInput.addEventListener("dragover", (e) => e.preventDefault());
    markdownInput.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadAndInsertFile(e.dataTransfer.files[0]);
      }
    });

    markdownInput.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let item of items) {
        if (item.kind === "file") {
          uploadAndInsertFile(item.getAsFile());
        }
      }
    });
  }

  if (imageFileInput) {
    imageFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadAndInsertFile(e.target.files[0]);
      }
    });
  }

  async function uploadAndInsertFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAutosave("error", `File too large (${(file.size / 1048576).toFixed(1)} MB). Max 5 MB.`);
      return;
    }

    showAutosave("saving", "Uploading...");
    const reader = new FileReader();

    reader.onerror = () => showAutosave("error", "Failed to read file");

    reader.onload = async () => {
      const currentSlug = originalSlug || generateSlug(titleInput?.value || "");
      try {
        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name || "pasted-image.png",
            contentType: file.type || "image/png",
            base64Data: reader.result,
            postSlug: currentSlug,
          }),
        });

        const data = await res.json().catch(() => ({ message: "Unknown error" }));

        if (res.ok && data.url) {
          const isImg = file.type?.startsWith("image") || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
          insertAtCursor(isImg ? `\n![${file.name}](${data.url})\n` : `\n[📎 ${file.name}](${data.url})\n`);
          if (!coverInput?.value && isImg) coverInput.value = data.url;
          updateCoverPreview();
          showAutosave("saved", "Uploaded!");
        } else {
          showAutosave("error", "Upload failed: " + (data.message || ""));
        }
      } catch (err) {
        showAutosave("error", "Upload failed: " + err.message);
      }
    };

    reader.readAsDataURL(file);
  }

  // ─── Autosave ────────────────────────────────────────────────────────
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (titleInput?.value?.trim() && markdownInput?.value?.trim()) {
        saveArticle("draft", true);
      }
    }, 3000);
  }

  function showAutosave(state, text) {
    if (!autosaveEl) return;
    autosaveEl.className = "editor-autosave";
    if (state === "saving") {
      autosaveEl.classList.add("editor-autosave--saving");
      autosaveEl.textContent = text || "Saving...";
    } else if (state === "saved") {
      autosaveEl.classList.add("editor-autosave--saved");
      autosaveEl.textContent = text || "Saved ✓";
      setTimeout(() => { autosaveEl.style.opacity = "0.5"; }, 2000);
    } else if (state === "error") {
      autosaveEl.classList.add("editor-autosave--error");
      autosaveEl.textContent = text || "Save failed";
    }
    autosaveEl.style.opacity = "1";
  }

  // ─── Save / Publish ──────────────────────────────────────────────────
  async function saveArticle(action, isAuto = false) {
    const title = titleInput?.value?.trim();
    const content = markdownInput?.value?.trim();

    if (!title || !content) {
      if (!isAuto) alert("Please provide both a title and content.");
      return;
    }

    if (!isAuto) {
      showAutosave("saving", action === "publish" ? "Publishing..." : "Saving...");
    } else {
      showAutosave("saving");
    }

    if (publishBtn) publishBtn.disabled = true;

    try {
      const res = await fetch("/api/posts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          originalSlug,
          description: descInput?.value || "",
          date: dateInput?.value || "",
          tags: currentTags.join(", "),
          cover: coverInput?.value || "",
          content,
          action,
        }),
      });

      const data = await res.json().catch(() => ({ message: "Parse error" }));

      if (res.ok) {
        if (data.slug && !originalSlug) originalSlug = data.slug;
        currentStatus = action === "publish" ? "published" : "draft";
        updateStatusBadge();
        showAutosave("saved");
        if (!isAuto) {
          setTimeout(() => { window.location.href = "/admin/"; }, 600);
        }
      } else {
        showAutosave("error", "Save failed: " + (data.message || ""));
        if (!isAuto) alert("Save failed: " + (data.message || ""));
      }
    } catch (err) {
      showAutosave("error", "Save failed");
      if (!isAuto) alert("Save failed: " + err.message);
    } finally {
      if (publishBtn) publishBtn.disabled = false;
    }
  }

  function updateStatusBadge() {
    if (!statusBadge) return;
    statusBadge.textContent = currentStatus.toUpperCase();
    statusBadge.className = `editor-status editor-status--${currentStatus}`;
    if (publishBtnText) {
      publishBtnText.textContent = currentStatus === "published" ? "Update" : "Publish";
    }
  }

  if (publishBtn) publishBtn.addEventListener("click", () => saveArticle("publish"));
  const saveBtn = document.getElementById("editor-save");
  if (saveBtn) saveBtn.addEventListener("click", () => saveArticle("draft"));

  // ─── Load Existing Post ──────────────────────────────────────────────
  if (editSlug) {
    if (headingLabel) headingLabel.textContent = "Edit Article";

    try {
      const res = await fetch(`/api/posts/get?slug=${encodeURIComponent(editSlug)}`);
      if (res.ok) {
        const data = await res.json();
        const fm = data.frontmatter || {};
        if (titleInput) { titleInput.value = fm.title || editSlug; autoResize(titleInput); }
        if (slugPreview) slugPreview.textContent = `/blogs/?post=${editSlug}`;
        if (dateInput) dateInput.value = fm.date || "";
        if (descInput) { descInput.value = fm.description || ""; autoResize(descInput); }
        if (coverInput) coverInput.value = fm.cover || "";
        currentTags = Array.isArray(fm.tags) ? [...fm.tags] : [];
        renderTags();
        updateCoverPreview();
        currentStatus = fm.status || "draft";
        updateStatusBadge();
        if (markdownInput) markdownInput.value = data.body || "";
        updatePreview();
        updateWordCount();
        updateOutline();
      }
    } catch (err) {
      console.error("Error loading article:", err);
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────
  updatePreview();
  updateWordCount();
  updateOutline();
  renderTags();
  updateCoverPreview();
  if (titleInput) autoResize(titleInput);
  if (descInput) autoResize(descInput);
});
