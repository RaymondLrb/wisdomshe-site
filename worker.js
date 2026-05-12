export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    try {
      const cfg = getConfig(env);

      if (request.method === "POST" && path === "/submit") {
        const payload = await request.json();
        const result = await addApplication(cfg, payload);
        return json({ success: true, application: result }, corsHeaders);
      }

      if (request.method === "GET" && path === "/applications") {
        const data = await readData(cfg);
        return json({ success: true, generated_at: data.generated_at || null, items: Array.isArray(data.applications) ? data.applications : [] }, corsHeaders);
      }

      if (request.method === "PATCH" && path.startsWith("/applications/")) {
        const id = Number(path.split("/").pop());
        if (!Number.isFinite(id)) return json({ success: false, error: "Invalid id" }, corsHeaders, 400);
        const body = await request.json();
        const nextStatus = String(body?.status || "").toLowerCase();
        if (!["new", "reviewing", "closed"].includes(nextStatus)) return json({ success: false, error: "Invalid status" }, corsHeaders, 400);
        const updated = await updateApplicationStatus(cfg, id, nextStatus);
        if (!updated) return json({ success: false, error: "Not found" }, corsHeaders, 404);
        return json({ success: true, application: updated }, corsHeaders);
      }

      if (request.method === "DELETE" && path.startsWith("/applications/")) {
        const id = Number(path.split("/").pop());
        if (!Number.isFinite(id)) return json({ success: false, error: "Invalid id" }, corsHeaders, 400);
        const ok = await deleteApplication(cfg, id);
        if (!ok) return json({ success: false, error: "Not found" }, corsHeaders, 404);
        return json({ success: true }, corsHeaders);
      }

      return json({ success: false, error: "Not Found" }, corsHeaders, 404);
    } catch (err) {
      return json({ success: false, error: String(err?.message || err) }, corsHeaders, 500);
    }
  },
};

function getConfig(env) {
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const branch = env.GH_BRANCH || "main";
  const dataPath = env.GH_DATA_PATH || "data/applications.json";
  const token = env.GH_TOKEN;
  if (!owner || !repo || !token) throw new Error("Missing required env: GH_OWNER, GH_REPO, GH_TOKEN");
  return { owner, repo, branch, dataPath, token };
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "wisdomshe-worker"
  };
}


function json(payload, corsHeaders, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

function decodeBase64Utf8(base64Text) {
  const clean = (base64Text || "").replace(/\n/g, "");
  return decodeURIComponent(escape(atob(clean)));
}

function encodeBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function getGithubFile(cfg) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.dataPath}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, { headers: ghHeaders(cfg.token) });
  if (res.status === 404) return { exists: false, sha: null, data: { generated_at: null, applications: [] } };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  const file = await res.json();
  const raw = decodeBase64Utf8(file.content || "");
  const clean = raw ? raw.replace(/^\uFEFF/, "") : "";
  const parsed = clean ? JSON.parse(clean) : { generated_at: null, applications: [] };
  return { exists: true, sha: file.sha, data: parsed };
}

async function putGithubFile(cfg, data, sha, message) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.dataPath}`;
  const content = encodeBase64Utf8(JSON.stringify(data, null, 2));
  const body = { message, content, branch: cfg.branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: { ...ghHeaders(cfg.token), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status} ${out.message || ""}`);
  return out;
}

async function readData(cfg) {
  const file = await getGithubFile(cfg);
  const data = file.data || { generated_at: null, applications: [] };
  if (!Array.isArray(data.applications)) data.applications = [];
  return data;
}

function normalizeInput(payload) {
  return {
    kind: payload?.kind || "diagnostic",
    name: String(payload?.name || "").trim(),
    phone: String(payload?.phone || "").trim(),
    email: String(payload?.email || "").trim(),
    company: String(payload?.company || "").trim(),
    budget_band: String(payload?.budget_band || "").trim(),
    business_line: String(payload?.business_line || "general").trim(),
    current_issue: String(payload?.current_issue || "").trim(),
    service_interest: String(payload?.service_interest || "").trim(),
    source_page: String(payload?.source_page || "").trim(),
    project_stage: String(payload?.project_stage || "").trim(),
  };
}

async function addApplication(cfg, payload) {
  const file = await getGithubFile(cfg);
  const data = file.data || { generated_at: null, applications: [] };
  if (!Array.isArray(data.applications)) data.applications = [];
  const input = normalizeInput(payload);
  if (!input.name || !input.phone || !input.current_issue) throw new Error("Missing required fields: name, phone, current_issue");
  const nextId = data.applications.length > 0 ? Math.max(...data.applications.map((x) => Number(x.id) || 0)) + 1 : 1;
  const now = new Date().toISOString();
  const record = { id: nextId, code: `REQ-${String(nextId).padStart(4, "0")}`, ...input, status: "new", created_at: now, updated_at: now, payload: { ...input } };
  data.generated_at = now;
  data.applications.unshift(record);
  await putGithubFile(cfg, data, file.sha, `Add application ${record.code}`);
  return { code: record.code, created_at: now };
}

async function updateApplicationStatus(cfg, id, status) {
  const file = await getGithubFile(cfg);
  const data = file.data || { generated_at: null, applications: [] };
  if (!Array.isArray(data.applications)) data.applications = [];
  const idx = data.applications.findIndex((x) => Number(x.id) === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  data.applications[idx].status = status;
  data.applications[idx].updated_at = now;
  data.generated_at = now;
  await putGithubFile(cfg, data, file.sha, `Update status for REQ-${String(id).padStart(4, "0")}`);
  return data.applications[idx];
}

async function deleteApplication(cfg, id) {
  const file = await getGithubFile(cfg);
  const data = file.data || { generated_at: null, applications: [] };
  if (!Array.isArray(data.applications)) data.applications = [];
  const before = data.applications.length;
  data.applications = data.applications.filter((x) => Number(x.id) !== id);
  if (data.applications.length === before) return false;
  data.generated_at = new Date().toISOString();
  await putGithubFile(cfg, data, file.sha, `Delete application REQ-${String(id).padStart(4, "0")}`);
  return true;
}
