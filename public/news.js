(function () {
  "use strict";
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function date(s) {
    return s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
  }
  function card(article) {
    const a = el("a", "rv-news-card");
    a.href = "/noticias/" + encodeURIComponent(article.slug);
    if (article.coverUrl) {
      const img = el("img"); img.src = article.coverUrl; img.alt = "Capa: " + article.title; img.loading = "lazy";
      a.appendChild(img);
    } else a.appendChild(el("div", "rv-card-placeholder", "Notícia"));
    const block = el("div", "rv-card-text");
    block.appendChild(el("strong", "", article.title));
    block.appendChild(el("p", "", article.summary));
    block.appendChild(el("small", "", date(article.publishedAt)));
    a.appendChild(block);
    return a;
  }
  async function api(path) {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Não foi possível carregar as notícias.");
    return response.json();
  }
  async function home() {
    const grid = document.getElementById("rv-news-home");
    if (!grid) return;
    try {
      const data = await api("/api/news?limit=5");
      grid.replaceChildren();
      if (!data.items.length) { grid.appendChild(el("p", "rv-empty", "Ainda não há notícias publicadas.")); return; }
      for (const article of data.items) grid.appendChild(card(article));
    } catch { grid.replaceChildren(el("p", "rv-empty", "Notícias temporariamente indisponíveis.")); }
  }
  function appendRichText(root, delta) {
    const ops = Array.isArray(delta?.ops) ? delta.ops : [];
    let chunks = [];
    function appendLine(attrs) {
      let target;
      const header = attrs?.header;
      if ([1, 2, 3].includes(header)) target = el(header === 1 ? "h2" : "h3");
      else if (attrs?.blockquote) target = el("blockquote");
      else if (attrs?.list) {
        const listTag = attrs.list === "ordered" ? "ol" : "ul";
        const previous = root.lastElementChild;
        const list = previous?.tagName.toLowerCase() === listTag ? previous : el(listTag);
        if (list !== previous) root.appendChild(list);
        target = el("li");
        for (const piece of chunks) target.appendChild(piece);
        list.appendChild(target);
        chunks = [];
        return;
      } else target = el("p");
      if (chunks.length) for (const piece of chunks) target.appendChild(piece);
      else target.appendChild(document.createTextNode("\u00a0"));
      root.appendChild(target); chunks = [];
    }
    for (const op of ops) {
      if (op.insert && typeof op.insert === "object" && op.insert.rvvideo) {
        if (chunks.length) appendLine({});
        const item = op.insert.rvvideo;
        const wrapper = el("div", "rv-video-embed");
        if (item.provider === "upload" && /^\/media\/video\/[a-f0-9-]{36}\.webm$/.test(item.url)) {
          const player = el("video");
          player.controls = true; player.preload = "metadata"; player.playsInline = true;
          player.src = item.url; wrapper.appendChild(player); root.appendChild(wrapper);
        } else if ((item.provider === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(item.id)) ||
                   (item.provider === "vimeo" && /^[0-9]{1,12}$/.test(item.id))) {
          const frame = el("iframe");
          frame.src = item.provider === "youtube"
            ? "https://www.youtube-nocookie.com/embed/" + item.id
            : "https://player.vimeo.com/video/" + item.id;
          frame.title = "Vídeo da matéria"; frame.loading = "lazy";
          frame.allowFullscreen = true;
          frame.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
          frame.referrerPolicy = "strict-origin-when-cross-origin";
          wrapper.appendChild(frame); root.appendChild(wrapper);
        }
        continue;
      }
      if (op.insert && typeof op.insert === "object" && typeof op.insert.image === "string") {
        if (chunks.length) appendLine({});
        if (!/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(op.insert.image)) continue;
        const img = el("img");
        img.src = op.insert.image; img.alt = "Imagem da matéria"; img.loading = "lazy";
        const width = op.attributes?.width;
        const align = op.attributes?.imgAlign;
        if (["25%", "50%", "75%", "100%"].includes(width)) img.style.width = width;
        if (["left", "center", "right"].includes(align)) {
          img.classList.add("rv-img-" + align);
        }
        root.appendChild(img); continue;
      }
      if (typeof op.insert !== "string") continue;
      const parts = op.insert.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          let content = document.createTextNode(parts[i]);
          const attr = op.attributes || {};
          if (attr.bold) { const b = el("strong"); b.appendChild(content); content = b; }
          if (attr.italic) { const em = el("em"); em.appendChild(content); content = em; }
          if (attr.underline) { const u = el("u"); u.appendChild(content); content = u; }
          if (typeof attr.link === "string" && /^https:\/\//.test(attr.link)) {
            const a = el("a"); a.href = attr.link; a.rel = "noopener noreferrer"; a.target = "_blank";
            a.appendChild(content); content = a;
          }
          chunks.push(content);
        }
        if (i < parts.length - 1) appendLine(op.attributes || {});
      }
    }
    if (chunks.length) appendLine({});
  }
  async function detail(slug) {
    const view = document.getElementById("news-detail");
    const list = document.getElementById("news-list");
    if (!view || !list) return;
    list.classList.add("rv-hidden"); view.classList.remove("rv-hidden");
    view.replaceChildren(el("p", "", "Carregando notícia..."));
    try {
      const a = await api("/api/news/" + encodeURIComponent(slug));
      document.title = a.title + " | Rio Verde Merece Saber";
      view.replaceChildren(el("p", "rv-help", date(a.publishedAt)), el("h1", "", a.title), el("p", "rv-help", a.summary));
      if (a.coverUrl) {
        const img = el("img"); img.src = a.coverUrl; img.alt = "Capa: " + a.title; view.appendChild(img);
      }
      appendRichText(view, a.body);
      view.appendChild(el("p", "rv-help", "Notícias e relatos são apresentados com responsabilidade editorial. Alegações não equivalem a comprovação ou condenação."));
    } catch { view.replaceChildren(el("p", "rv-error", "Notícia não encontrada ou indisponível.")); }
  }
  async function listing() {
    const view = document.getElementById("news-list");
    const more = document.getElementById("more-news");
    if (!view || !more) return;
    let page = 1;
    view.replaceChildren(el("div", "rv-grid"));
    const grid = view.firstElementChild;
    async function load() {
      more.disabled = true;
      try {
        const result = await api("/api/news?limit=15&page=" + page);
        for (const item of result.items) grid.appendChild(card(item));
        if (page === 1 && !result.items.length) view.replaceChildren(el("p", "rv-empty", "Ainda não há notícias publicadas."));
        more.classList.toggle("rv-hidden", result.items.length < 15);
        page++;
      } catch { view.appendChild(el("p", "rv-error", "Não foi possível carregar as notícias.")); }
      finally { more.disabled = false; }
    }
    more.addEventListener("click", load);
    await load();
  }
  home();
  const path = window.location.pathname;
  if (path === "/noticias" || path === "/noticias/") listing();
  else if (path.startsWith("/noticias/")) {
    const slug = path.slice("/noticias/".length).replace(/\/$/, "");
    if (slug && slug !== "index.html") detail(slug);
  }
})();
