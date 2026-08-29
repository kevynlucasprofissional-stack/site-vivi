(function () {
  function apply() {
    const buttons = document.querySelector('.processo-botoes');
    if (buttons && !document.getElementById('btn-processo-pdf')) {
      const link = document.createElement('a');
      link.id = 'btn-processo-pdf';
      link.href = '/processo.html';
      link.className = 'btn btn-download';
      link.textContent = 'Visualizar e baixar processo completo (PDF) ↓';
      buttons.appendChild(link);
    }

    const note = document.querySelector('.processo-nota');
    if (note) {
      note.textContent = 'Decisão judicial de 12/05/2026 — 1º Juízo das Garantias de Goiânia. A versão do PDF disponibilizada neste site possui autorização para publicação.';
    }

    const docsDownload = document.querySelector('.docs-download');
    if (docsDownload) {
      docsDownload.innerHTML = `
        <p>Você pode consultar a fonte oficial no TJGO ou abrir a cópia do PDF disponibilizada neste site.</p>
        <a href="/processo.html" class="btn btn-download" style="width:100%; max-width:400px;">Visualizar e baixar processo completo (PDF) ↓</a>
        <a href="https://projudi.tjgo.jus.br/BuscaProcesso?PaginaAtual=4" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="width:100%; max-width:400px;">Consultar no TJGO (Projudi) →</a>
        <p style="font-size:12px; color:#64748b; margin-top:10px; margin-bottom:0;">PDF disponibilizado neste site com autorização para publicação.</p>`;
    }

    document.querySelectorAll('.aviso-legal li').forEach(function (li) {
      if (li.textContent.includes('PDF integral identificado como sigiloso não é redistribuído')) {
        li.textContent = 'A cópia integral do PDF disponibilizada nesta página possui autorização para publicação.';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
})();
