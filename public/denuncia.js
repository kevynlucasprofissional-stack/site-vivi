(function () {
  "use strict";
  const form = document.getElementById("report-form");
  const status = document.getElementById("report-status");
  const button = form.querySelector('button[type="submit"]');

  function feedback(message) {
    status.textContent = message;
    status.className = message ? "rv-error" : "";
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    feedback("");
    try {
      const message = form.elements.namedItem("message").value;
      const response = await fetch("/api/reports", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar a denúncia.");
      document.getElementById("protocol").textContent = data.protocol;
      form.classList.add("rv-hidden");
      document.getElementById("report-done").classList.remove("rv-hidden");
    } catch (error) {
      feedback(error.message || "Não foi possível enviar a denúncia.");
    } finally {
      button.disabled = false;
    }
  });
})();
