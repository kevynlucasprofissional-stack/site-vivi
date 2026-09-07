(function () {
  function replaceVideoCard() {
    const card = document.querySelector('#videos .video-card');
    if (!card || card.dataset.localVideoApplied === 'true') return Boolean(card);

    card.dataset.localVideoApplied = 'true';
    card.innerHTML = `
      <div class="video-embed">
        <video
          controls
          playsinline
          preload="metadata"
          poster="/assets/cortes-simulatio-poster.jpg"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;display:block;"
          aria-label="Cortes da Operação Simulatio"
        >
          <source src="/assets/cortes-operacao-simulatio.mp4" type="video/mp4">
          Seu navegador não suporta a reprodução deste vídeo.
        </video>
      </div>
      <div class="video-info">
        <span class="video-tag">Compilado de imprensa · Operação Simulatio</span>
        <h3>Cortes da Operação Simulatio</h3>
        <p>Compilado em vídeo com trechos de coberturas jornalísticas e pronunciamentos sobre a operação.</p>
      </div>`;
    return true;
  }

  if (replaceVideoCard()) return;

  const observer = new MutationObserver(function () {
    if (replaceVideoCard()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
