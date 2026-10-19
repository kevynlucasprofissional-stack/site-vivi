// Cloudflare Worker: site estático + API de notícias e denúncias. Sem dependências de runtime.
const encoder = new TextEncoder();
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const mediaTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function json(data, status = 200, privateData = false) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json; charset=utf-8",
      ...(privateData ? noStore : { "Cache-Control": "public, max-age=30" }) }
  });
}
function fail(message, status = 400) { return json({ error: message }, status, true); }
function isText(value, max) { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max; }
function now() { return new Date().toISOString(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function hex(bytes) { return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(""); }
function unhex(s) { return new Uint8Array((s.match(/.{2}/g) || []).map((x) => parseInt(x, 16))); }
function base64Url(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function decodeBase64Url(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: 100000 }, key, 256
  ));
}
async function signedSession(env, revision = "bootstrap") {
  const data = { exp: Date.now() + 8 * 3600 * 1000, nonce: crypto.randomUUID(), rev: revision };
  const message = base64Url(encoder.encode(JSON.stringify(data)));
  return message + "." + base64Url(await hmac(env.ADMIN_SESSION_SECRET, message));
}
async function activeCredentials(env) {
  const row = await env.DB.prepare(
    "SELECT username,email,password_hash,password_salt,revision FROM admin_settings WHERE id=1"
  ).first();
  if (row) return {
    username: row.username, email: row.email, hash: row.password_hash,
    salt: row.password_salt, revision: row.revision
  };
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT) return null;
  return {
    username: env.ADMIN_USERNAME, email: null,
    hash: env.ADMIN_PASSWORD_HASH, salt: env.ADMIN_PASSWORD_SALT, revision: "bootstrap"
  };
}
async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) return false;
  const token = (request.headers.get("Cookie") || "").split(";")
    .map(x => x.trim()).find(x => x.startsWith("rv_admin="))?.slice(9);
  if (!token || token.length > 2000) return false;
  const pieces = token.split(".");
  if (pieces.length !== 2) return false;
  try {
    const expected = await hmac(env.ADMIN_SESSION_SECRET, pieces[0]);
    const supplied = decodeBase64Url(pieces[1]);
    if (!equal(expected, supplied)) return false;
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(pieces[0])));
    if (!(Number.isFinite(data.exp) && data.exp > Date.now() &&
        data.exp <= Date.now() + 8 * 3600 * 1000)) return false;
    const credentials = await activeCredentials(env);
    return !!credentials && data.rev === credentials.revision;
  } catch { return false; }
}
function correctOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin && origin === new URL(request.url).origin;
}
async function readJson(request, maxBytes = 110000) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new Error("JSON obrigatório");
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > maxBytes) throw new Error("Dados muito extensos");
  const text = await request.text();
  if (encoder.encode(text).length > maxBytes) throw new Error("Dados muito extensos");
  return JSON.parse(text);
}
async function turnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY || !isText(token, 2048)) return false;
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || undefined })
    });
    if (!result.ok) return false;
    const data = await result.json();
    return data.success === true && (!data.hostname || data.hostname === new URL(request.url).hostname);
  } catch { return false; }
}
async function limiter(env, request, type, maximum = 5) {
  if (!env.MEDIA || !env.ADMIN_SESSION_SECRET) return false;
  const fingerprint = hex(await hmac(env.ADMIN_SESSION_SECRET,
    type + ":" + (request.headers.get("CF-Connecting-IP") || "unknown")));
  const key = "rate:" + type + ":" + fingerprint;
  const count = Number(await env.MEDIA.get(key) || 0);
  if (count >= maximum) return false;
  await env.MEDIA.put(key, String(count + 1), { expirationTtl: 900 });
  return true;
}
function cleanDelta(value) {
  if (!value || !Array.isArray(value.ops) || value.ops.length > 1000) return null;
  const ops = [], allowed = ["bold", "italic", "underline", "list", "header", "link", "blockquote"];
  let length = 0;
  for (const op of value.ops) {
    const ins = op.insert;
    if (typeof ins === "string") {
      length += ins.length;
      if (length > 35000) return null;
      const attrs = {};
      for (const key of allowed) {
        const v = op.attributes?.[key];
        if (key === "link" && typeof v === "string" && /^https:\/\/[^\s<>"]{1,500}$/i.test(v)) attrs[key] = v;
        else if (["bold", "italic", "underline", "blockquote"].includes(key) && v === true) attrs[key] = true;
        else if (key === "header" && [1, 2, 3].includes(v)) attrs[key] = v;
        else if (key === "list" && ["bullet", "ordered"].includes(v)) attrs[key] = v;
      }
      ops.push(Object.keys(attrs).length ? { insert: ins, attributes: attrs } : { insert: ins });
    } else if (ins && typeof ins.image === "string" && /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(ins.image)) {
      // Image metadata is an allowlisted subset of Quill's Delta formats.
      // Never pass through user-supplied styles or external image URLs.
      const attrs = {};
      if (["25%", "50%", "75%", "100%"].includes(op.attributes?.width)) attrs.width = op.attributes.width;
      if (["left", "center", "right"].includes(op.attributes?.imgAlign)) attrs.imgAlign = op.attributes.imgAlign;
      const image = { insert: { image: ins.image } };
      if (Object.keys(attrs).length) image.attributes = attrs;
      ops.push(image);
    } else if (ins && ins.rvvideo && typeof ins.rvvideo === "object") {
      const item = ins.rvvideo;
      if (item.provider === "youtube" && typeof item.id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(item.id)) {
        ops.push({ insert: { rvvideo: { provider: "youtube", id: item.id } } });
      } else if (item.provider === "vimeo" && typeof item.id === "string" && /^[0-9]{1,12}$/.test(item.id)) {
        ops.push({ insert: { rvvideo: { provider: "vimeo", id: item.id } } });
      } else if (item.provider === "upload" && typeof item.url === "string" &&
          /^\/media\/video\/[a-f0-9-]{36}\.webm$/.test(item.url)) {
        ops.push({ insert: { rvvideo: { provider: "upload", url: item.url } } });
      } else return null;
    } else return null;
  }
  return length > 0 ? JSON.stringify({ ops }) : null;
}
function slugify(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}
function publicArticle(r, detail = false) {
  const item = { id: r.id, slug: r.slug, title: r.title, summary: r.summary,
    coverUrl: r.cover_url, publishedAt: r.published_at };
  if (detail) item.body = JSON.parse(r.body_delta);
  return item;
}
async function publicNews(request, env, pathname, url) {
  if (pathname === "/api/news") {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 5));
    const page = Math.min(200, Math.max(1, Number(url.searchParams.get("page")) || 1));
    const rows = await env.DB.prepare(
      "SELECT id,slug,title,summary,cover_url,published_at FROM articles WHERE published=1 ORDER BY published_at DESC LIMIT ? OFFSET ?"
    ).bind(limit, (page - 1) * limit).all();
    return json({ items: rows.results.map(r => publicArticle(r)), page, limit });
  }
  const slug = pathname.slice("/api/news/".length);
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return fail("Notícia não encontrada", 404);
  const row = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND published=1").bind(slug).first();
  return row ? json(publicArticle(row, true)) : fail("Notícia não encontrada", 404);
}
function csvCell(value) {
  let s = String(value == null ? "" : value).replace(/\r\n?/g, "\n");
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
async function exportsHandler(env, format) {
  if (!["csv", "json"].includes(format)) return fail("Formato inválido");
  const data = await env.DB.prepare("SELECT id,content,created_at FROM reports ORDER BY created_at DESC LIMIT 50000").all();
  const items = data.results;
  let body, contentType, extension;
  if (format === "json") {
    body = JSON.stringify(items, null, 2);
    contentType = "application/json; charset=utf-8"; extension = "json";
  } else {
    const fields = ["id", "content", "created_at"];
    body = "\ufeff" + [fields.join(";"), ...items.map(r => fields.map(k => csvCell(r[k])).join(";"))].join("\r\n");
    contentType = "text/csv; charset=utf-8"; extension = "csv";
  }
  return new Response(body, { headers: { ...noStore, "Content-Type": contentType,
    "Content-Disposition": 'attachment; filename="denuncias-' + new Date().toISOString().slice(0, 10) + '.' + extension + '"' } });
}
async function newsWrite(env, data, currentId) {
  if (!isText(data.title, 180) || !isText(data.summary, 400)) return fail("Informe título e resumo válidos.");
  const slug = slugify(data.slug || data.title);
  if (!slug || slug.length > 90) return fail("Slug inválido.");
  const body = cleanDelta(data.body);
  if (!body) return fail("O corpo da matéria está vazio ou inválido.");
  const cover = data.coverUrl || null;
  if (cover !== null && !/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(cover)) return fail("Imagem de capa inválida.");
  const published = data.published === true ? 1 : 0;
  const timestamp = now();
  try {
    if (currentId) {
      const old = await env.DB.prepare("SELECT published_at FROM articles WHERE id=?").bind(currentId).first();
      if (!old) return fail("Notícia não encontrada.", 404);
      await env.DB.prepare(
        "UPDATE articles SET slug=?,title=?,summary=?,cover_url=?,body_delta=?,published=?,published_at=?,updated_at=? WHERE id=?"
      ).bind(slug, data.title.trim(), data.summary.trim(), cover, body, published,
        published ? old.published_at || timestamp : null, timestamp, currentId).run();
      return json({ id: currentId, slug }, 200, true);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO articles (id,slug,title,summary,cover_url,body_delta,published,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, slug, data.title.trim(), data.summary.trim(), cover, body, published,
      timestamp, timestamp, published ? timestamp : null).run();
    return json({ id, slug }, 201, true);
  } catch (err) {
    if (/UNIQUE constraint failed/.test(String(err))) return fail("Já existe uma notícia com esse endereço.", 409);
    throw err;
  }
}
function isRealImage(buf, type) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (type === "image/png") return b.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/jpeg") return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (type === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}
async function mediaUpload(request, env) {
  if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data")) return fail("Arquivo inválido.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 3 * 1024 * 1024 + 10000) return fail("Imagem deve ter até 3 MB.", 413);
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || !mediaTypes[file.type] || file.size > 3 * 1024 * 1024 || file.size < 30) {
    return fail("Envie JPG, PNG ou WebP, até 3 MB.");
  }
  const body = await file.arrayBuffer();
  if (!isRealImage(body, file.type)) return fail("Formato real da imagem inválido.");
  const key = crypto.randomUUID() + "." + mediaTypes[file.type];
  await env.MEDIA.put("img:" + key, body, { metadata: { type: file.type } });
  return json({ url: "/media/" + key }, 201, true);
}
async function accountUpdate(request, env) {
  if (!await limiter(env, request, "account", 6)) return fail("Muitas tentativas. Aguarde 15 minutos.", 429);
  const data = await readJson(request, 6000);
  const current = await activeCredentials(env);
  if (!current || !isText(data.currentPassword, 256)) return fail("Senha atual obrigatória.", 400);
  const supplied = await passwordHash(data.currentPassword, current.salt);
  if (!equal(supplied, unhex(current.hash))) return fail("Senha atual incorreta.", 403);
  const username = typeof data.username === "string" ? data.username.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
    return fail("Usuário deve ter entre 3 e 80 caracteres, usando letras, números, ponto, hífen ou sublinhado.");
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return fail("E-mail inválido.");
  }
  const newPassword = data.newPassword || "";
  if (typeof newPassword !== "string" || newPassword.length > 256 ||
      (newPassword && newPassword.length < 12)) return fail("A nova senha precisa de 12 a 256 caracteres.");
  if (!newPassword && username === current.username && email === (current.email || "")) {
    return fail("Nenhuma alteração informada.");
  }
  const salt = newPassword ? hex(crypto.getRandomValues(new Uint8Array(16))) : current.salt;
  const hash = newPassword ? hex(await passwordHash(newPassword, salt)) : current.hash;
  const revision = crypto.randomUUID();
  let result;
  if (current.revision === "bootstrap") {
    result = await env.DB.prepare(
      "INSERT OR IGNORE INTO admin_settings (id,username,email,password_salt,password_hash,revision,updated_at) VALUES (1,?,?,?,?,?,?)"
    ).bind(username, email || null, salt, hash, revision, now()).run();
  } else {
    result = await env.DB.prepare(
      "UPDATE admin_settings SET username=?,email=?,password_salt=?,password_hash=?,revision=?,updated_at=? WHERE id=1 AND revision=?"
    ).bind(username, email || null, salt, hash, revision, now(), current.revision).run();
  }
  if ((result?.meta?.changes ?? result?.changes ?? 0) !== 1) {
    return fail("Os dados administrativos mudaram em outra sessão. Entre novamente e tente outra vez.", 409);
  }
  const token = await signedSession(env, revision);
  const response = json({ ok: true, username, email }, 200, true);
  response.headers.set("Set-Cookie",
    "rv_admin=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800");
  return response;
}
async function videoUpload(request, env) {
  // Workers KV offers 25 MiB per value. Keep smaller encoded WebM media
  // for predictable processing and the existing free-tier storage capacity.
  const max = 15 * 1024 * 1024;
  if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data")) return fail("Arquivo de vídeo inválido.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > max + 20000) return fail("Vídeo convertido excede o limite de 15 MiB.", 413);
  const data = await request.formData();
  const file = data.get("video");
  if (!(file instanceof File) || file.type !== "video/webm" || file.size < 100 || file.size > max) {
    return fail("Envie vídeo convertido para WebM, com até 15 MiB.", 413);
  }
  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes.slice(0, 4));
  if (signature.join(",") !== "26,69,223,163") return fail("Arquivo WebM inválido.");
  const id = crypto.randomUUID() + ".webm";
  await env.MEDIA.put("vid:" + id, bytes, { metadata: { type: "video/webm" } });
  return json({ url: "/media/video/" + id, size: file.size }, 201, true);
}
async function videoResponse(request, env, path) {
  if (!/^\/media\/video\/[a-f0-9-]{36}\.webm$/.test(path)) return fail("Vídeo não encontrado.", 404);
  const result = await env.MEDIA.getWithMetadata("vid:" + path.split("/").pop(), { type: "arrayBuffer" });
  if (!result.value) return fail("Vídeo não encontrado.", 404);
  const bytes = new Uint8Array(result.value), total = bytes.byteLength;
  const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" };
  const range = request.headers.get("Range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416,
      headers: { ...headers, "Content-Range": "bytes */" + total } });
    let first = match[1] ? Number(match[1]) : null;
    let last = match[2] ? Number(match[2]) : null;
    if (first === null && last === null) return fail("Intervalo inválido.", 416);
    if (first === null) { first = Math.max(0, total - last); last = total - 1; }
    else { last = last === null ? total - 1 : Math.min(last, total - 1); }
    if (!Number.isInteger(first) || !Number.isInteger(last) || first >= total || last < first) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": "bytes */" + total } });
    }
    return new Response(bytes.slice(first, last + 1), { status: 206,
      headers: { ...headers, "Content-Range": `bytes ${first}-${last}/${total}`, "Content-Length": String(last - first + 1) } });
  }
  return new Response(bytes, { headers: { ...headers, "Content-Length": String(total) } });
}
async function adminApi(request, env, path, url) {
  const method = request.method;
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) {
      return fail("Administração não configurada.", 503);
    }
    const credentials = await activeCredentials(env);
    if (!credentials) return fail("Administração não configurada.", 503);
    if (!await limiter(env, request, "login", 7)) return fail("Muitas tentativas. Aguarde 15 minutos.", 429);
    const data = await readJson(request, 5000);
    // O login administrativo usa credenciais fortes, verificação de origem e limite de
    // tentativas. Turnstile continua obrigatório nas denúncias públicas.
    if (!isText(data.password, 256) || !isText(data.username, 120))
      return fail("Credenciais inválidas.", 401);
    const actual = await passwordHash(data.password, credentials.salt);
    const usernameValid = data.username === credentials.username ||
      (!!credentials.email && data.username.toLowerCase() === credentials.email.toLowerCase());
    const valid = equal(actual, unhex(credentials.hash));
    if (!usernameValid || !valid) { await sleep(200); return fail("Credenciais inválidas.", 401); }
    const token = await signedSession(env, credentials.revision);
    const response = json({ ok: true }, 200, true);
    response.headers.set("Set-Cookie", "rv_admin=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800");
    return response;
  }
  if (!await isAdmin(request, env)) return fail("Acesso administrativo não autorizado.", 401);
  if (path === "/api/admin/session" && method === "GET") return json({ authenticated: true }, 200, true);
  if (path === "/api/admin/account" && method === "GET") {
    const current = await activeCredentials(env);
    return json({ username: current.username, email: current.email || "" }, 200, true);
  }
  if (path === "/api/admin/account" && method === "PUT") return accountUpdate(request, env);
  if (path === "/api/admin/logout" && method === "POST") {
    const response = json({ ok: true }, 200, true);
    response.headers.set("Set-Cookie", "rv_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
    return response;
  }
  if (path === "/api/admin/reports" && method === "GET") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = Math.min(100000, Math.max(0, Number(url.searchParams.get("offset")) || 0));
    const rows = await env.DB.prepare("SELECT id,content,created_at FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    return json({ items: rows.results, limit, offset }, 200, true);
  }
  if (path === "/api/admin/reports/export" && method === "GET") {
    return exportsHandler(env, url.searchParams.get("format"));
  }
  if (path === "/api/admin/news" && method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM articles ORDER BY created_at DESC LIMIT 250").all();
    return json({ items: rows.results.map(r => ({ ...publicArticle(r, true), published: !!r.published,
      createdAt: r.created_at, updatedAt: r.updated_at })) }, 200, true);
  }
  if (path === "/api/admin/news" && method === "POST") return newsWrite(env, await readJson(request));
  if (/^\/api\/admin\/news\/[a-f0-9-]{36}$/.test(path) && method === "PUT") {
    return newsWrite(env, await readJson(request), path.slice("/api/admin/news/".length));
  }
  if (path === "/api/admin/media" && method === "POST") return mediaUpload(request, env);
  if (path === "/api/admin/videos" && method === "POST") return videoUpload(request, env);
  return fail("Rota administrativa não encontrada.", 404);
}
async function reportApi(request, env) {
  if (!await limiter(env, request, "reports", 3)) return fail("Limite de envios atingido. Aguarde 15 minutos.", 429);
  const data = await readJson(request, 12000);
  if (!isText(data.message, 8000) || data.message.trim().length < 15) {
    return fail("Descreva sua denúncia com pelo menos 15 caracteres.");
  }
  const id = crypto.randomUUID(), time = now();
  await env.DB.prepare(
    "INSERT INTO reports (id,name,email,phone,content,consent_at,created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(id, "Anônima", "", "", data.message.trim(), "", time).run();
  return json({ ok: true, protocol: id }, 201, true);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    try {
      if (path === "/api/config" && request.method === "GET") {
        return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" }, 200, true);
      }
      if (path === "/api/reports" && request.method === "POST") {
        if (!correctOrigin(request)) return fail("Origem não autorizada.", 403);
        if (!env.DB || !env.MEDIA) return fail("Serviço ainda não configurado.", 503);
        return await reportApi(request, env);
      }
      if (path.startsWith("/api/admin/")) {
        if (!env.DB || !env.MEDIA) return fail("Serviço ainda não configurado.", 503);
        if (!["GET", "HEAD"].includes(request.method) && !correctOrigin(request)) return fail("Origem não autorizada.", 403);
        return await adminApi(request, env, path, url);
      }
      if (path === "/api/news" || path.startsWith("/api/news/")) {
        if (request.method !== "GET") return fail("Método não permitido.", 405);
        if (!env.DB) return fail("Serviço ainda não configurado.", 503);
        return await publicNews(request, env, path, url);
      }
      if (path.startsWith("/media/")) {
        if (!env.MEDIA) return fail("Mídia não configurada.", 503);
        if (path.startsWith("/media/video/")) {
          if (!["GET", "HEAD"].includes(request.method)) return fail("Método não permitido.", 405);
          return videoResponse(request, env, path);
        }
        if (!/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path)) return fail("Imagem não encontrada.", 404);
        const obj = await env.MEDIA.getWithMetadata("img:" + path.slice(7), { type: "arrayBuffer" });
        if (!obj.value) return fail("Imagem não encontrada.", 404);
        return new Response(obj.value, { headers: { "Content-Type": obj.metadata?.type || "application/octet-stream",
          "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
      }
      if (path === "/admin" || path === "/admin/") {
        return env.ASSETS.fetch(new Request(new URL("/admin/", url), request));
      }
      if (path === "/denuncia" || path === "/denuncia/") {
        return env.ASSETS.fetch(new Request(new URL("/denuncia/", url), request));
      }
      if (path === "/noticias" || path === "/noticias/" || path.startsWith("/noticias/")) {
        return env.ASSETS.fetch(new Request(new URL("/noticias/", url), request));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker API error", { path, error: String(error).slice(0, 300) });
      return fail("Não foi possível concluir a operação.", 500);
    }
  }
};
