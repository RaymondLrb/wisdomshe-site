(async function () {
  const runtime = window.STRATEGIC_OFFICE_RUNTIME || {};
  const siteRoot = runtime.siteRoot || window.SITE_ROOT || "../../";
  const slug = window.BOOK_SLUG;
  if (!slug) return;

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mountList(selector, items) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  try {
    const response = await fetch(`${siteRoot}assets/data/strategic-office-content.json`);
    const data = await response.json();
    const book = (data.books || []).find((item) => item.slug === slug);
    if (!book) return;

    document.title = `${book.title} | shedatahk limited Strategic Office`;
    document.querySelector("[data-book-positioning]").textContent = book.positioning;
    document.querySelector("[data-book-title]").textContent = book.title;
    document.querySelector("[data-book-subtitle]").textContent = book.subtitle;
    document.querySelector("[data-book-summary]").textContent = book.summary;
    document.querySelector("[data-book-claim]").textContent = book.hero_claim;
    document.querySelector("[data-book-version]").textContent = book.current_version;
    document.querySelector("[data-book-status]").textContent = "公开层：书摘 + 框架页；内部层：持续修订";
    document.querySelector("[data-book-source]").textContent = book.root_path;

    const excerptsNode = document.querySelector("[data-book-excerpts]");
    excerptsNode.innerHTML = (book.public_excerpts || [])
      .map(
        (excerpt) => `
        <article class="card">
          <span class="badge">公开书摘</span>
          <h3>${escapeHtml(excerpt.title)}</h3>
          <p>${escapeHtml(excerpt.excerpt).replace(/\n\n/g, "</p><p>")}</p>
          <p class="small muted">源文件：${escapeHtml(excerpt.source_path)}</p>
        </article>`
      )
      .join("");

    const caseNode = document.querySelector("[data-book-cases]");
    caseNode.innerHTML = (book.case_cards || [])
      .map(
        (card) => `
        <article class="mini-card">
          <h4>${escapeHtml(card.title)}</h4>
          <p>${escapeHtml(card.excerpt).replace(/\n\n/g, "</p><p>")}</p>
        </article>`
      )
      .join("");

    const mappingNode = document.querySelector("[data-service-mapping]");
    mappingNode.innerHTML = (book.service_mapping || [])
      .map(
        (item) => `
        <article class="mini-card">
          <h4>${escapeHtml(item.service_name)}</h4>
          <p>${escapeHtml(item.fit)}</p>
        </article>`
      )
      .join("");

    mountList("[data-member-modules]", book.member_modules || []);
    mountList("[data-client-extensions]", book.client_extensions || []);
    mountList("[data-current-focus]", book.current_focus || []);
  } catch (error) {
    const status = document.querySelector("[data-load-status]");
    if (status) {
      status.textContent = "这本书的数据暂时未加载成功，请稍后再试。";
      status.classList.add("error");
    }
    console.error(error);
  }
})();
