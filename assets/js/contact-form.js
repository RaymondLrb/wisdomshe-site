(function () {
  const DEFAULT_LOCAL_ORIGIN = "http://127.0.0.1:8801";

  function setHiddenValue(form, name, value) {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  }

  function readParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
  }

  function joinUrl(origin, path) {
    return `${origin.replace(/\/$/, "")}${path}`;
  }

  function getRuntimeConfig() {
    const config = window.WISDOMSHE_CONFIG || {};
    const isFile = window.location.protocol === "file:";
    const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    const fallbackOrigin = isFile || isLocalHost ? DEFAULT_LOCAL_ORIGIN : window.location.origin;
    const apiOrigin = config.apiOrigin || fallbackOrigin;
    const adminOrigin = config.adminOrigin || config.apiOrigin || fallbackOrigin;
    return { apiOrigin, adminOrigin };
  }

  function fieldValue(form, name) {
    const field = form.querySelector(`[name="${name}"]`);
    return field ? field.value.trim() : "";
  }

  function inferEmail(contactDetails) {
    const value = (contactDetails || "").trim();
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
  }

  function inferDisplayName(contactDetails) {
    const value = (contactDetails || "").trim();
    if (!value) return "网站访客";
    if (value.includes("@")) return value.split("@")[0].slice(0, 80) || "网站访客";
    return value.slice(0, 80);
  }

  function inferBusinessLine(pathname) {
    if (pathname.includes("/portfolio/")) return "capital";
    return "industry";
  }

  function businessLineLabel(businessLine) {
    return businessLine === "capital" ? "投资组合管理" : "实业 IP 服务";
  }

  function stampAdminLinks() {
    const { adminOrigin } = getRuntimeConfig();
    const adminHref = joinUrl(adminOrigin, "/login");
    document.querySelectorAll("[data-admin-link]").forEach((link) => {
      link.href = adminHref;
    });
  }

  function serializePayload(form) {
    const businessLine = fieldValue(form, "business_line") || inferBusinessLine(window.location.pathname);
    const companyName = fieldValue(form, "company");
    const serviceInterest = fieldValue(form, "service_interest") || businessLineLabel(businessLine);
    const projectStage = fieldValue(form, "project_stage");
    const currentIssue = fieldValue(form, "problem_statement") || fieldValue(form, "current_problem");
    const desiredSolution = fieldValue(form, "desired_solution");
    const simpleContact = fieldValue(form, "contact_details");
    const explicitPhone = fieldValue(form, "contact_number");
    const explicitEmail = fieldValue(form, "email");
    const phone = explicitPhone || (explicitEmail ? "" : simpleContact);
    const email = explicitEmail || inferEmail(simpleContact);
    const budgetBand = fieldValue(form, "budget_note") || fieldValue(form, "budget_band");
    const applicantName = fieldValue(form, "name") || fieldValue(form, "contact_name") || inferDisplayName(simpleContact);
    const contactDetails = [explicitEmail && `邮箱：${explicitEmail}`, explicitPhone && `电话/微信/WhatsApp：${explicitPhone}`, simpleContact && `联系方式：${simpleContact}`]
      .filter(Boolean)
      .join("；");
    const solutionSummary = [currentIssue && `问题：${currentIssue}`, desiredSolution && `希望的解决方案：${desiredSolution}`]
      .filter(Boolean)
      .join("\n");

    return {
      kind: serviceInterest === "会员服务" ? "membership" : "consultation",
      applicant_name: applicantName,
      company_name: companyName,
      email,
      phone,
      business_line: businessLine,
      source_page: fieldValue(form, "source_page") || window.location.pathname,
      service_interest: serviceInterest,
      project_stage: projectStage,
      current_issue: currentIssue,
      budget_band: budgetBand,
      preferred_contact: phone ? "phone-whatsapp" : email ? "email" : "contact-details",
      identity_type: companyName ? "company-or-project" : "individual",
      background: [
        companyName && `主体：${companyName}`,
        projectStage && `阶段：${projectStage}`,
        budgetBand && `预算：${budgetBand}`,
        contactDetails,
        solutionSummary,
      ]
        .filter(Boolean)
        .join("\n"),
      application_reason: solutionSummary || currentIssue || serviceInterest,
      admin_notes: fieldValue(form, "consent") ? `公开站同意联系：${fieldValue(form, "consent")}` : null,
      primary_book: businessLine === "capital" ? "asset-long-wave" : null,
    };
  }

  async function submitToBackend(form, statusNode) {
    const { apiOrigin } = getRuntimeConfig();
    const response = await fetch(joinUrl(apiOrigin, "/api/applications"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serializePayload(form)),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "后台未接受这次提交。");
    }
    return payload.application;
  }

  stampAdminLinks();

  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    const statusNode = form.querySelector("[data-form-status]") || form.parentElement.querySelector("[data-form-status]");
    setHiddenValue(form, "source_page", `${window.location.pathname}${window.location.search}`);

    const preselectedService = form.querySelector('[name="service_interest"]');
    const serviceFromQuery = readParam("service");
    if (preselectedService && serviceFromQuery) {
      preselectedService.value = serviceFromQuery;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!statusNode) return;

      statusNode.textContent = "正在提交到 shedatahk limited 共享后台，请稍候。";
      statusNode.classList.remove("error", "success");

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      try {
        const application = await submitToBackend(form, statusNode);
        const line = fieldValue(form, "business_line") || inferBusinessLine(window.location.pathname);
        statusNode.textContent = `已进入 shedatahk limited 共享后台，编号 ${application.code}。这条线索会按“${businessLineLabel(
          line
        )}”分流给对应团队继续跟进；如果你希望更快沟通，也可以直接继续用 WhatsApp 联系。`;
        statusNode.classList.add("success");
        form.reset();
        setHiddenValue(form, "source_page", `${window.location.pathname}${window.location.search}`);
        setHiddenValue(form, "business_line", line);
      } catch (error) {
        statusNode.textContent = `提交没有成功写入后台。请稍后重试；如果你现在就要继续推进，可以直接发邮件到 adam@wisdomshe.com 或 WhatsApp +852 5535 7390。错误信息：${error.message}`;
        statusNode.classList.add("error");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
})();
