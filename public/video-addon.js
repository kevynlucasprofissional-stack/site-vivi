(function () {
  function updateSectionCopy() {
    const section = document.querySelector('#videos');
    if (!section) return false;

    const title = section.querySelector('.section-title');
    const lead = section.querySelector('.lead');

    if (title) title.textContent = 'Cobertura jornalística';
    if (lead) lead.textContent = 'Vídeos e matérias sobre a Operação Simulatio.';

    return true;
  }

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
        <span class="video-tag">Operação Simulatio</span>
        <h3>Cortes da Operação Simulatio</h3>
      </div>`;
    return true;
  }

  function applyVideoSection() {
    const copyReady = updateSectionCopy();
    const cardReady = replaceVideoCard();
    return copyReady && cardReady;
  }

  if (applyVideoSection()) return;

  const observer = new MutationObserver(function () {
    if (applyVideoSection()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
