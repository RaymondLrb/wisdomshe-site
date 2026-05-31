(function () {
  const config = window.WISDOMSHE_CONFIG || {};
  const workerEndpoint = (config.workerEndpoint || "").replace(/\/$/, "");
  const adminOrigin = config.adminOrigin || "";
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

  function buildFallback(contact, budget, details, line) {
    const subject = encodeURIComponent("wisdomshe.com 新需求");
    const body = encodeURIComponent(
      [
        "业务方向：" + (line === "capital" ? "投资组合管理与香港功能地产" : "医药项目与实业 IP"),
        "联系方式：" + contact,
        "预算：" + budget,
        "",
        "问题与解决方案：",
        details,
      ].join("\n")
    );
    return "mailto:adam@wisdomshe.com?subject=" + subject + "&body=" + body;
  }

  async function submitToWorker(payload) {
    if (!workerEndpoint) throw new Error("workerEndpoint 未配置");
    const response = await fetch(`${workerEndpoint}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
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
        project_stage: "website-intake",
      };

      setStatus("正在提交...", "");
      try {
        const result = await submitToWorker(payload);
        setStatus(`提交成功，编号 ${result.application?.code || "已记录"}。`, "is-success");
        form.reset();
        setLine(businessLine);
      } catch (error) {
        setStatus(`提交失败：${error.message}`, "is-error");
        window.location.href = buildFallback(contactMethod, budgetBand, currentIssue, businessLine);
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

  document.querySelectorAll(".nav-link-live-admin").forEach((node) => {
    if (adminOrigin) {
      node.setAttribute("href", adminOrigin.replace(/\/$/, "") + "/admin/");
    }
  });
})();
