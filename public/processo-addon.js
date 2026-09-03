(function () {
  const pdfUrl = '/assets/documentos/BuscaProcesso.pdf';

  function apply() {
    const buttons = document.querySelector('.processo-botoes');
    if (buttons && !document.getElementById('btn-processo-pdf')) {
      const link = document.createElement('a');
      link.id = 'btn-processo-pdf';
      link.href = pdfUrl;
      link.className = 'btn btn-download';
      link.setAttribute('download', 'BuscaProcesso.pdf');
      link.textContent = 'Baixar processo completo (PDF) ↓';
      buttons.appendChild(link);
    }

    const note = document.querySelector('.processo-nota');
    if (note) {
      note.textContent = 'Decisão judicial de 12/05/2026 — 1º Juízo das Garantias de Goiânia. A versão do PDF disponibilizada neste site possui autorização para publicação.';
    }

    const docsDownload = document.querySelector('.docs-download');
    if (docsDownload) {
      docsDownload.remove();
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
