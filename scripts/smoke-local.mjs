import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
const checks = [
  ["/", 200, "site-loader.js"],
  ["/site-base.html", 200, "documentos"],
  ["/site-patch.js", 200, "Faça sua denúncia! Clique aqui"],
  ["/denuncia", 200, "report-form"],
  ["/admin", 200, "login-form"],
  ["/noticias", 200, "news-list"],
  ["/noticias/materia-test", 200, "news-detail"],
  ["/api/news?limit=5", 200, "\"items\""],
  ["/api/config", 200, "turnstileSiteKey"],
  ["/api/admin/reports", 401, "não autorizado"],
  ["/api/admin/reports/export?format=json", 401, "não autorizado"],
  ["/media/invalid.jpg", 404, "não encontrada"]
];
let errors = 0;
for (const [path, status, expected] of checks) {
  try {
    const response = await fetch(origin + path);
    const html = await response.text();
    assert.equal(response.status, status, path);
    assert.ok(html.toLowerCase().includes(expected.toLowerCase()), path + " does not contain " + expected);
    console.log("OK", response.status, path);
  } catch (error) { errors++; console.error("FAIL", path, String(error)); }
}
const post = await fetch(origin + "/api/reports", {
  method: "POST", headers: { Origin: "https://malicious.example", "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Teste", email: "test@test.com", phone: "62999999999",
    message: "Conteúdo com dezesseis caracteres", consent: true, turnstileToken: "invalid" })
});
assert.equal(post.status, 403);
console.log("OK", post.status, "POST origem indevida");
if (errors) process.exitCode = 1;
