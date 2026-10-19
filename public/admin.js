(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const loginPanel = byId("login-panel"), dashboard = byId("dashboard"), loginForm = byId("login-form");
  const loginStatus = byId("login-status"), reportsPanel = byId("reports-panel"), newsPanel = byId("news-panel"), accountPanel = byId("account-panel");
  const editorStatus = byId("editor-status");
  let reportOffset = 0, coverUrl = "", editingId = null;
  let quill;
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function feedback(node, message, error = false) {
    node.textContent = message || "";
    node.className = message ? (error ? "rv-error" : "rv-success") : "";
  }
  async function req(url, init) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 401 && !url.endsWith("/login")) {
        loginPanel.classList.remove("rv-hidden"); dashboard.classList.add("rv-hidden");
      }
      throw new Error(body?.error || "Não foi possível concluir a operação.");
    }
    return body;
  }
  function tab(name) {
    const reports = name === "reports";
    const articles = name === "news";
    const account = name === "account";
    reportsPanel.classList.toggle("rv-hidden", !reports);
    newsPanel.classList.toggle("rv-hidden", !articles);
    accountPanel.classList.toggle("rv-hidden", !account);
    byId("reports-tab").classList.toggle("secondary", !reports);
    byId("news-tab").classList.toggle("secondary", !articles);
    byId("account-tab").classList.toggle("secondary", !account);
    if (reports) loadReports(true);
    if (articles) loadArticles();
    if (account) loadAccount();
  }
  async function showDashboard() {
    loginPanel.classList.add("rv-hidden");
    dashboard.classList.remove("rv-hidden");
    if (!quill) {
      if (!window.Quill) { feedback(editorStatus, "Editor não carregado. Atualize a página.", true); return; }
      window.RvVideo.register(Quill);
      quill = new Quill("#article-editor", {
        theme: "snow", placeholder: "Escreva aqui a matéria, com títulos, links e imagens...",
        modules: { toolbar: { container: "#editor-toolbar", handlers: {
          image: function () {
            const input = document.createElement("input");
            input.type = "file"; input.accept = "image/jpeg,image/png,image/webp";
            input.onchange = async () => {
              if (!input.files?.length) return;
              try {
                const url = await upload(input.files[0]);
                const position = quill.getSelection(true)?.index ?? quill.getLength();
                quill.insertEmbed(position, "image", url, "user");
                quill.setSelection(position + 1, 0);
              } catch (error) { feedback(editorStatus, error.message, true); }
            };
            input.click();
          }
        } } }
      });
      quill.on("text-change", renderPreview);
      window.RvVideo.bind(() => quill, async file => {
        const form = new FormData();
        form.set("video", file);
        const result = await req("/api/admin/videos", { method: "POST", body: form });
        return result.url;
      }, (message, error = false) => feedback(byId("video-upload-status"), message, error));
    }
    tab("reports");
    renderPreview();
  }
  async function upload(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) {
      throw new Error("Escolha uma imagem JPG, PNG ou WebP de até 3 MB.");
    }
    const form = new FormData(); form.set("image", file);
    const result = await req("/api/admin/media", { method: "POST", body: form });
    return result.url;
  }
  function previewCard() {
    const a = el("div", undefined, "rv-news-card");
    if (coverUrl) {
      const img = el("img"); img.src = coverUrl; img.alt = "Capa da matéria"; a.appendChild(img);
    } else a.appendChild(el("div", "Prévia da imagem de capa", "rv-card-placeholder"));
    const contents = el("div", undefined, "rv-card-text");
    contents.appendChild(el("strong", byId("news-title").value.trim() || "Título da matéria"));
    contents.appendChild(el("p", byId("news-summary").value.trim() || "O resumo da notícia aparecerá aqui."));
    contents.appendChild(el("small", "Data de publicação"));
    a.appendChild(contents);
    return a;
  }
  function renderPreview() {
    byId("preview-desktop").replaceChildren(previewCard());
    byId("preview-mobile").replaceChildren(previewCard());
  }
  async function loadReports(reset) {
    if (reset) { reportOffset = 0; byId("report-list").replaceChildren(); }
    try {
      const { items } = await req("/api/admin/reports?limit=50&offset=" + reportOffset);
      const tbody = byId("report-list");
      for (const r of items) {
        const row = el("tr");
        for (const value of [new Date(r.created_at).toLocaleString("pt-BR"), r.name, r.email, r.phone, r.content]) {
          const td = el("td", value);
          if (value === r.content) td.className = "rv-report";
          row.appendChild(td);
        }
        tbody.appendChild(row);
      }
      reportOffset += items.length;
      byId("more-reports").classList.toggle("rv-hidden", items.length < 50);
      byId("report-empty").textContent = reportOffset ? "Denúncias exibidas: " + reportOffset : "Nenhuma denúncia recebida.";
    } catch (error) { byId("report-empty").textContent = error.message; }
  }
  async function exportAs(format) {
    try {
      const response = await fetch("/api/admin/reports/export?format=" + format, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível exportar denúncias.");
      const blob = await response.blob(), a = document.createElement("a");
      const link = URL.createObjectURL(blob);
      a.href = link; a.download = "denuncias-" + new Date().toISOString().slice(0, 10) + "." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(link), 1000);
    } catch (error) { byId("report-empty").textContent = error.message; }
  }
  async function loadArticles() {
    const area = byId("admin-articles");
    area.replaceChildren(el("p", "Carregando..."));
    try {
      const { items } = await req("/api/admin/news");
      area.replaceChildren();
      if (!items.length) { area.appendChild(el("p", "Nenhuma matéria salva.")); return; }
      for (const item of items) {
        const line = el("div", undefined, "rv-actions rv-mb");
        line.appendChild(el("strong", item.title + (item.published ? " · Publicada" : " · Rascunho")));
        const button = el("button", "Editar", "rv-btn secondary"); button.type = "button";
        button.onclick = function () {
          editingId = item.id; coverUrl = item.coverUrl || "";
          byId("news-title").value = item.title; byId("news-slug").value = item.slug;
          byId("news-summary").value = item.summary;
          byId("news-published").checked = item.published;
          quill.setContents(item.body || { ops: [] });
          byId("editor-heading").textContent = "Editar notícia";
          feedback(editorStatus, "Editando uma matéria salva.");
          renderPreview();
          byId("news-title").scrollIntoView({ behavior: "smooth", block: "start" });
        };
        line.appendChild(button); area.appendChild(line);
      }
    } catch (error) { area.replaceChildren(el("p", error.message, "rv-error")); }
  }
  function clearForm() {
    editingId = null; coverUrl = ""; byId("news-form").reset();
    if (quill) quill.setText("");
    byId("editor-heading").textContent = "Nova notícia";
    feedback(editorStatus, "");
    byId("news-cover-status").textContent = "";
    renderPreview();
  }
  async function loadAccount() {
    const status = byId("account-status");
    try {
      const info = await req("/api/admin/account");
      byId("account-username").value = info.username;
      byId("account-email").value = info.email || "";
      feedback(status, "");
    } catch (error) { feedback(status, error.message, true); }
  }
  byId("account-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const status = byId("account-status");
    const newPassword = byId("account-new-password").value;
    const confirm = byId("account-confirm-password").value;
    if (newPassword !== confirm) {
      feedback(status, "A confirmação da nova senha não coincide.", true);
      return;
    }
    if (newPassword && newPassword.length < 12) {
      feedback(status, "A nova senha precisa ter pelo menos 12 caracteres.", true);
      return;
    }
    const button = this.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await req("/api/admin/account", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: byId("account-username").value.trim(),
          email: byId("account-email").value.trim(),
          currentPassword: byId("account-current-password").value,
          newPassword
        })
      });
      byId("account-current-password").value = "";
      byId("account-new-password").value = "";
      byId("account-confirm-password").value = "";
      feedback(status, "Credenciais atualizadas. As sessões anteriores foram encerradas.");
    } catch (error) { feedback(status, error.message, true); }
    finally { button.disabled = false; }
  });
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const btn = loginForm.querySelector("button[type=submit]"); btn.disabled = true;
    const f = new FormData(loginForm);
    try {
      await req("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: f.get("username"), password: f.get("password") }) });
      loginForm.querySelector('[name=password]').value = "";
      feedback(loginStatus, "");
      await showDashboard();
    } catch (error) { feedback(loginStatus, error.message, true); }
    finally {
      btn.disabled = false;
    }
  });
  byId("logout").onclick = async function () {
    try { await req("/api/admin/logout", { method: "POST" }); } catch {}
    location.reload();
  };
  byId("reports-tab").onclick = () => tab("reports");
  byId("news-tab").onclick = () => tab("news");
  byId("account-tab").onclick = () => tab("account");
  byId("refresh-reports").onclick = () => loadReports(true);
  byId("more-reports").onclick = () => loadReports(false);
  byId("export-csv").onclick = () => exportAs("csv");
  byId("export-json").onclick = () => exportAs("json");
  byId("new-article").onclick = clearForm;
  byId("news-title").addEventListener("input", renderPreview);
  byId("news-summary").addEventListener("input", renderPreview);
  byId("news-cover").addEventListener("change", async function () {
    if (!this.files?.length) return;
    byId("news-cover-status").textContent = "Enviando imagem...";
    try {
      coverUrl = await upload(this.files[0]);
      byId("news-cover-status").textContent = "Capa enviada com sucesso.";
      renderPreview();
    } catch (error) { byId("news-cover-status").textContent = error.message; }
  });
  byId("news-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (window.RvVideo?.isBusy()) {
      feedback(editorStatus, "Aguarde o vídeo terminar de converter e enviar antes de salvar.", true);
      return;
    }
    if (!quill || (!quill.getText().trim() && !quill.getContents().ops.some(op => op.insert?.rvvideo))) {
      feedback(editorStatus, "Insira texto ou vídeo na matéria.", true); return;
    }
    const button = this.querySelector("button[type=submit]"); button.disabled = true;
    try {
      const data = {
        title: byId("news-title").value,
        slug: byId("news-slug").value,
        summary: byId("news-summary").value,
        coverUrl: coverUrl || null,
        body: quill.getContents(), published: byId("news-published").checked
      };
      const path = editingId ? "/api/admin/news/" + editingId : "/api/admin/news";
      await req(path, { method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      feedback(editorStatus, data.published ? "Notícia publicada com sucesso." : "Rascunho salvo com sucesso.");
      clearForm(); await loadArticles();
      feedback(editorStatus, data.published ? "Notícia publicada com sucesso." : "Rascunho salvo com sucesso.");
    } catch (error) { feedback(editorStatus, error.message, true); }
    finally { button.disabled = false; }
  });
  req("/api/admin/session").then(showDashboard).catch(() => {});
})();
