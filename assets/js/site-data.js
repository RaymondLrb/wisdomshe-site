(async function () {
  const runtime = window.STRATEGIC_OFFICE_RUNTIME || {};
  const siteRoot = runtime.siteRoot || window.SITE_ROOT || "";
  const apiRoot = (runtime.apiBaseUrl || "").replace(/\/$/, "");
  const dataUrl = `${siteRoot}assets/data/strategic-office-content.json`;

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function linkForBook(slug) {
    const map = {
      "asset-long-wave": `${siteRoot}books/asset-long-wave/`,
      "portfolio-execution": `${siteRoot}books/portfolio-execution/`,
      "timing-discipline": `${siteRoot}books/timing-discipline/`,
    };
    return map[slug] || `${siteRoot}books/`;
  }

  function renderPaymentLinks(service) {
    const entries = Object.entries(service.payment_links || {});
    if (!entries.length) {
      return `<p class="muted small">当前可用：二维码/转账。线上支付链接会在配置完成后自动显示。</p>`;
    }
    return `
      <div class="actions">
        ${entries
          .map(
            ([currency, url]) =>
              `<a class="button-soft" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">线上支付 ${escapeHtml(currency)}</a>`
          )
          .join("")}
      </div>`;
  }

  function renderPricingCard(service) {
    const [primaryCurrency, primaryAmount] = Object.entries(service.pricing || {})[0] || ["HKD", "--"];
    const extraPrices = Object.entries(service.pricing || {})
      .slice(1)
      .map(([currency, amount]) => `<div class="muted small">${currency} ${amount}</div>`)
      .join("");
    return `
      <article class="card price-card">
        <span class="badge">${escapeHtml(service.title)}</span>
        <strong>${primaryCurrency} ${primaryAmount}</strong>
        ${extraPrices}
        <p class="muted">${escapeHtml(service.delivery_window || "")}</p>
        <ul class="check-list">
          ${service.deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        ${renderPaymentLinks(service)}
      </article>`;
  }

  try {
    const response = await fetch(dataUrl);
    const data = await response.json();
    if (apiRoot) {
      try {
        const bootstrapResponse = await fetch(`${apiRoot}/api/bootstrap`);
        if (bootstrapResponse.ok) {
          const bootstrap = await bootstrapResponse.json();
          if (bootstrap.success) {
            if (bootstrap.brand) data.brand = bootstrap.brand;
            if (bootstrap.services) data.services = bootstrap.services;
            if (bootstrap.payment_channels) data.payment_channels = bootstrap.payment_channels;
          }
        }
      } catch (bootstrapError) {
        console.warn("Strategic Office bootstrap fetch failed", bootstrapError);
      }
    }
    window.StrategicOfficeData = data;

    const tagline = document.querySelector("[data-brand-tagline]");
    if (tagline) {
      tagline.textContent = data.brand.tagline;
    }

    const bookGrid = document.querySelector("[data-book-grid]");
    if (bookGrid) {
      bookGrid.innerHTML = data.books
        .map(
          (book) => `
          <article class="card book-card">
            <span class="eyebrow">${escapeHtml(book.positioning)}</span>
            <h3>${escapeHtml(book.title)}</h3>
            <p class="muted">${escapeHtml(book.summary)}</p>
            <p><strong>当前版本：</strong>${escapeHtml(book.current_version)} · <strong>公开方式：</strong>书摘 + 框架页</p>
            <div class="actions">
              <a class="button" href="${linkForBook(book.slug)}">进入这本书</a>
            </div>
          </article>`
        )
        .join("");
    }

    const serviceGrid = document.querySelector("[data-public-services]");
    if (serviceGrid) {
      serviceGrid.innerHTML = data.services
        .filter((service) => service.public)
        .map((service) => {
          const prices = Object.entries(service.pricing || {})
            .map(([currency, amount]) => `<span class="chip">${currency} ${amount}</span>`)
            .join("");
          return `
            <article class="card price-card">
              <span class="badge">${escapeHtml(service.tier)}</span>
              <h3>${escapeHtml(service.title)}</h3>
              <p class="muted">${escapeHtml(service.fit)}</p>
              <div>${prices}</div>
              <ul class="check-list">
                ${service.deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>`;
        })
        .join("");
    }

    const pricingGrid = document.querySelector("[data-pricing-grid]");
    if (pricingGrid) {
      pricingGrid.innerHTML = data.services
        .filter((service) => service.public)
        .map((service) => renderPricingCard(service))
        .join("");
    }
  } catch (error) {
    const fallback = document.querySelector("[data-load-status]");
    if (fallback) {
      fallback.textContent = "内容数据暂时未加载成功，请稍后刷新或先查看静态说明。";
      fallback.classList.add("error");
    }
    console.error(error);
  }
})();
