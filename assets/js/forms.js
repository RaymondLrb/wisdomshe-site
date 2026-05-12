(function () {
  const runtime = window.WISDOMSHE_CONFIG || {};
  const apiRoot = (runtime.apiOrigin || "http://127.0.0.1:8801").replace(/\/$/, "");

  async function submitForm(form) {
    const statusNode = form.querySelector("[data-form-status]");
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.kind = form.dataset.kind || "diagnostic";
    payload.source_page = window.location.pathname;
    payload.business_line = payload.business_line || form.dataset.kind === "membership" ? "capital" : "industry";

    statusNode.textContent = `正在提交到 ${apiRoot}/api/applications`;
    statusNode.className = "status-note";

    try {
      const response = await fetch(`${apiRoot}/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "提交失败");
      statusNode.textContent = `提交成功，系统编号 ${result.application.code}`;
      statusNode.className = "status-note success";
      form.reset();
    } catch (error) {
      statusNode.textContent = "后台暂时未接通，请稍后重试。";
      statusNode.className = "status-note error";
      console.error(error);
    }
  }

  document.querySelectorAll("[data-office-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(form);
    });
  });
})();
