(function () {
  "use strict";
  const form = document.getElementById("report-form");
  const status = document.getElementById("report-status");
  const button = form.querySelector('button[type="submit"]');
  let token = "", widgetId = null;
  function feedback(message, error = true) {
    status.textContent = message;
    status.className = message ? (error ? "rv-error" : "rv-success") : "";
  }
  async function init() {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      const config = await response.json();
      if (!config.turnstileSiteKey) throw new Error("A verificação de segurança ainda não foi configurada.");
      let attempts = 0;
      const timer = setInterval(function () {
        attempts++;
        if (window.turnstile) {
          clearInterval(timer);
          widgetId = turnstile.render("#challenge", {
            sitekey: config.turnstileSiteKey,
            callback: function (value) { token = value; },
            "expired-callback": function () { token = ""; },
            "error-callback": function () { token = ""; }
          });
          button.disabled = false;
        } else if (attempts > 40) {
          clearInterval(timer);
          feedback("Não foi possível carregar a verificação de segurança. Recarregue a página.");
        }
      }, 250);
    } catch (error) { feedback(error.message); }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!token) { feedback("Conclua a verificação de segurança antes de enviar."); return; }
    button.disabled = true;
    feedback("");
    const f = new FormData(form);
    const payload = {
      name: String(f.get("name") || ""),
      email: String(f.get("email") || ""),
      phone: String(f.get("phone") || ""),
      message: String(f.get("message") || ""),
      consent: f.has("consent"), turnstileToken: token
    };
    try {
      const response = await fetch("/api/reports", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar a denúncia.");
      document.getElementById("protocol").textContent = body.protocol;
      form.classList.add("rv-hidden");
      document.getElementById("report-done").classList.remove("rv-hidden");
    } catch (error) {
      feedback(error.message);
      token = "";
      if (widgetId !== null && window.turnstile) turnstile.reset(widgetId);
    } finally { button.disabled = false; }
  });
  button.disabled = true;
  init();
})();
