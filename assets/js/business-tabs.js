(function () {
  const HASH_GROUPS = {
    industry: new Set([
      "#industry-line",
      "#services",
      "#ip-expert",
      "#cooperation",
      "#advanced-ip",
      "#patent-counsel",
      "#scenes",
      "#industry-form",
    ]),
    capital: new Set([
      "#portfolio-line",
      "#method",
      "#hong-kong-property",
      "#portfolio-form",
    ]),
  };

  const TAB_ANCHORS = {
    industry: "#industry-line",
    capital: "#portfolio-line",
  };

  const tabButtons = Array.from(document.querySelectorAll("[data-business-target]"));
  const panels = Array.from(document.querySelectorAll("[data-business-panel]"));

  if (!tabButtons.length || !panels.length) return;

  function lineFromHash(hash) {
    if (HASH_GROUPS.capital.has(hash)) return "capital";
    if (HASH_GROUPS.industry.has(hash)) return "industry";
    return null;
  }

  function setActive(line) {
    tabButtons.forEach((button) => {
      const active = button.dataset.businessTarget === line;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.businessPanel !== line;
    });
  }

  function syncWithHash() {
    const hash = window.location.hash || "";
    const line = lineFromHash(hash) || "industry";
    setActive(line);

    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start" });
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const line = button.dataset.businessTarget;
      setActive(line);
      const anchor = TAB_ANCHORS[line];
      if (window.location.hash !== anchor) {
        history.replaceState(null, "", anchor);
      }
      const target = document.querySelector(anchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute("href");
    const line = lineFromHash(hash);
    if (!line) return;
    setActive(line);
  });

  window.addEventListener("hashchange", syncWithHash);
  syncWithHash();
})();
