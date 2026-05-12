(function () {
  const cfg = window.WISDOMSHE_CONFIG || {};
  const worker = (cfg.workerEndpoint || "").replace(/\/$/, "");
  const lineInput = document.getElementById("business-line-input");
  const lineSwitches = document.querySelectorAll("[data-line-switch]");
  const tabButtons = document.querySelectorAll("[data-business-tab]");
  const panels = document.querySelectorAll("[data-business-panel]");
  const form = document.getElementById("lead-form");
  const statusNode = document.getElementById("form-status");

  function setLine(line) {
    if (!lineInput) return;
    lineInput.value = line;
    lineSwitches.forEach((button) =>
      button.classList.toggle("is-active", button.dataset.lineSwitch === line)
    );
    tabButtons.forEach((button) => {
      const active = button.dataset.businessTab === line;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.businessPanel === line;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function setStatus(message, kind) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.remove("is-error", "is-success");
    if (kind) statusNode.classList.add(kind);
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const applicantName = document.getElementById("applicant-name")?.value.trim() || "";
      const contactMethod = document.getElementById("contact-method")?.value.trim() || "";
      const budgetBand = document.getElementById("budget-band")?.value.trim() || "";
      const currentIssue = document.getElementById("current-issue")?.value.trim() || "";
      const businessLine = lineInput?.value || "industry";

      if (!applicantName || !contactMethod || !currentIssue) {
        setStatus("请至少填写称呼、联系方式和问题说明。", "is-error");
        return;
      }
      if (!worker) {
        setStatus("workerEndpoint 未配置。", "is-error");
        return;
      }

      const payload = {
        kind: businessLine === "capital" ? "portfolio" : "diagnostic",
        name: applicantName,
        phone: contactMethod,
        email: contactMethod.includes("@") ? contactMethod : "",
        company: "",
        budget_band: budgetBand,
        business_line: businessLine,
        current_issue: currentIssue,
        service_interest: currentIssue,
        source_page: window.location.pathname,
        project_stage: "website-intake"
      };

      setStatus("正在提交...", "");
      try {
        const response = await fetch(`${worker}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
        setStatus(`提交成功，编号 ${result.application?.code || "已记录"}。`, "is-success");
        form.reset();
        setLine(businessLine);
      } catch (error) {
        setStatus(`提交失败：${error.message}`, "is-error");
      }
    });
  }

  lineSwitches.forEach((button) =>
    button.addEventListener("click", () => setLine(button.dataset.lineSwitch))
  );
  tabButtons.forEach((button) =>
    button.addEventListener("click", () => {
      setLine(button.dataset.businessTab);
      document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  setLine(window.location.hash === "#portfolio" || window.location.hash === "#portfolio-line" ? "capital" : "industry");
})();
