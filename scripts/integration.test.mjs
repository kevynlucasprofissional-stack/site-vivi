import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker.js";

const origin = "https://rioverdemerecesaber.com";
const realFetch = globalThis.fetch;
function envForTest() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const KV = new Map();
  const salt = "00112233445566778899aabbccddeeff";
  return {
    DB: { prepare(sql) {
      const statement = sqlite.prepare(sql);
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async all() { return { results: statement.all(...params) }; },
        async first() { return statement.get(...params) || null; },
        async run() { return statement.run(...params); }
      };
    } },
    MEDIA: {
      async get(k) { return KV.get(k)?.value || null; },
      async put(k, value, options) { KV.set(k, { value, metadata: options?.metadata }); },
      async getWithMetadata(k) { return KV.get(k) || { value: null }; }
    },
    ADMIN_USERNAME: "admin", ADMIN_PASSWORD_SALT: salt,
    ADMIN_PASSWORD_HASH: pbkdf2Sync("senha-forte-de-teste", Buffer.from(salt, "hex"), 210000, 32, "sha256").toString("hex"),
    ADMIN_SESSION_SECRET: "s".repeat(64),
    TURNSTILE_SITE_KEY: "testing", TURNSTILE_SECRET: "testing"
  };
}
function request(path, method = "GET", data, cookie) {
  return new Request(origin + path, {
    method, headers: {
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {})
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
}
test("integração: sessão, publicação, denúncia, acesso privado e CSV", async () => {
  const env = envForTest();
  globalThis.fetch = async url => {
    if (String(url).startsWith("https://challenges.cloudflare.com/")) {
      return new Response(JSON.stringify({ success: true, hostname: "rioverdemerecesaber.com" }),
        { headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url);
  };
  try {
    const invalid = await worker.fetch(request("/api/admin/login", "POST", {
      username: "admin", password: "incorreta", turnstileToken: "test"
    }), env);
    assert.equal(invalid.status, 401);

    const login = await worker.fetch(request("/api/admin/login", "POST", {
      username: "admin", password: "senha-forte-de-teste", turnstileToken: "test"
    }), env);
    assert.equal(login.status, 200);
    const cookie = login.headers.get("Set-Cookie").split(";")[0];
    assert.ok(cookie.startsWith("rv_admin="));

    const article = await worker.fetch(request("/api/admin/news", "POST", {
      title: "Título de teste", summary: "Resumo de teste",
      published: true, body: { ops: [{ insert: "Primeiro parágrafo da matéria.\n" }] }
    }, cookie), env);
    assert.equal(article.status, 201, await article.clone().text());
    const saved = await article.json();
    assert.equal(saved.slug, "titulo-de-teste");

    const publicFeed = await worker.fetch(request("/api/news?limit=5"), env);
    const { items } = await publicFeed.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Título de teste");
    assert.ok(!JSON.stringify(items).includes("body_delta"));
    const full = await worker.fetch(request("/api/news/titulo-de-teste"), env);
    assert.equal((await full.json()).body.ops[0].insert, "Primeiro parágrafo da matéria.\n");

    const report = await worker.fetch(request("/api/reports", "POST", {
      name: "=1+1", email: "denunciante@example.com", phone: "62999999999",
      message: "Um relato fictício de teste com conteúdo suficiente.", consent: true, turnstileToken: "test"
    }), env);
    assert.equal(report.status, 201, await report.clone().text());
    assert.ok((await report.json()).protocol);

    const denied = await worker.fetch(request("/api/admin/reports"), env);
    assert.equal(denied.status, 401);
    const privateReports = await worker.fetch(request("/api/admin/reports", "GET", undefined, cookie), env);
    assert.equal(privateReports.status, 200);
    assert.equal((await privateReports.json()).items.length, 1);

    const exportCsv = await worker.fetch(request("/api/admin/reports/export?format=csv", "GET", undefined, cookie), env);
    assert.equal(exportCsv.status, 200);
    const csv = await exportCsv.text();
    assert.ok(csv.includes("'=1+1"), "prevenção contra fórmulas CSV");
    assert.ok(csv.includes("denunciante@example.com"));
    assert.equal(exportCsv.headers.get("Cache-Control"), "no-store");

    const logout = await worker.fetch(request("/api/admin/logout", "POST", undefined, cookie), env);
    assert.equal(logout.status, 200);
    assert.ok(logout.headers.get("Set-Cookie").includes("Max-Age=0"));
  } finally { globalThis.fetch = realFetch; }
});
