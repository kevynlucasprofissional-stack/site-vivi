import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../worker.js";

const base = "https://rioverdemerecesaber.com";
function mockEnv() {
  return {
    DB: { prepare(sql) {
      return { bind() { return this; }, async all() { return { results: [] }; }, async first() { return null; } };
    } },
    MEDIA: { async get() { return null; }, async getWithMetadata() { return { value: null }; } },
    ASSETS: { async fetch(request) { return new Response(new URL(request.url).pathname); } }
  };
}
test("rota de denúncias exibe formulário sem expor dados", async () => {
  const response = await worker.fetch(new Request(base + "/denuncia"), mockEnv());
  assert.equal(await response.text(), "/denuncia/");
});
test("rota administrativa usa arquivo estático", async () => {
  const response = await worker.fetch(new Request(base + "/admin"), mockEnv());
  assert.equal(await response.text(), "/admin/");
});
test("rota de todas as notícias atende URL amigável", async () => {
  const response = await worker.fetch(new Request(base + "/noticias/uma-materia"), mockEnv());
  assert.equal(await response.text(), "/noticias/");
});
test("feed público vazio retorna coleção válida", async () => {
  const response = await worker.fetch(new Request(base + "/api/news?limit=5"), mockEnv());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.items, []);
});
test("denúncias e exportações não são acessíveis sem sessão", async () => {
  const paths = ["/api/admin/reports", "/api/admin/reports/export?format=csv", "/api/admin/news", "/api/admin/media"];
  for (const path of paths) {
    const response = await worker.fetch(new Request(base + path), mockEnv());
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});
test("POST fora da origem é bloqueado", async () => {
  const response = await worker.fetch(new Request(base + "/api/reports", {
    method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nome", message: "Teste" })
  }), mockEnv());
  assert.equal(response.status, 403);
});
test("não publica relatos no feed de notícias", async () => {
  const response = await worker.fetch(new Request(base + "/api/news"), mockEnv());
  const text = await response.text();
  assert.ok(!text.includes("email"));
  assert.ok(!text.includes("content"));
});


test("compatibilidade de PBKDF2 com o limite do Cloudflare Workers", () => {
  const workerSource = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const generatorSource = readFileSync(new URL("./prepare-admin.mjs", import.meta.url), "utf8");
  const repairSource = readFileSync(new URL("./repair-admin-login.mjs", import.meta.url), "utf8");
  assert.match(workerSource, /iterations:\s*100000/);
  assert.match(generatorSource, /,\s*100000,\s*32/);
  assert.match(repairSource, /,\s*100000,\s*32/);
});
