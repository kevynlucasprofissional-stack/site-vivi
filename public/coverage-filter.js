(function () {
  const selected = {
    'Jornal Somos': {
      title: 'Prefeitura de Rio Verde esclarece diligências da Operação Simulatio',
      desc: 'Cita Wellignton Carrijo e Paulo do Vale.'
    },
    'Folha no Sudoeste': {
      title: 'Rio Verde é alvo de diligências da Operação Simulatio',
      desc: 'Cobertura local dos mandados cumpridos no município.'
    },
    'Opa News': {
      title: 'Contrato de Rio Verde com empresa alvo da operação',
      desc: 'Matéria cita contrato firmado na gestão Paulo do Vale.'
    },
    'GYN Notícias': {
      title: 'Prefeitura de Rio Verde se posiciona sobre a operação',
      desc: 'Nota da administração municipal sobre as diligências.'
    },
    'Portal Notícias Goiás': {
      title: 'Carrijo comenta a Operação Simulatio em Rio Verde',
      desc: 'Posicionamento do prefeito durante coletiva.'
    }
  };

  const order = [
    'Jornal Somos',
    'Folha no Sudoeste',
    'Opa News',
    'GYN Notícias',
    'Portal Notícias Goiás'
  ];

  function filterVideoLinks(section) {
    const grid = section.querySelector('.video-links-grid');
    if (!grid) return false;

    const cards = Array.from(grid.querySelectorAll('.video-source-card'));
    if (!cards.length) return false;

    cards.forEach(function (card) {
      const outlet = card.querySelector('strong')?.textContent.trim() || '';
      if (outlet === 'Instagram') return;
      card.remove();
    });

    const subtitle = grid.previousElementSibling;
    if (subtitle && subtitle.classList.contains('media-subtitle')) {
      subtitle.textContent = 'Vídeos publicados por outros meios';
    }

    return true;
  }

  function applyFilter() {
    const section = document.querySelector('#videos');
    if (!section) return false;

    const videoReady = filterVideoLinks(section);

    const cards = Array.from(section.querySelectorAll('.coverage-card'));
    if (!cards.length) return false;

    const grid = cards[0].parentElement;
    const byOutlet = new Map();

    cards.forEach(function (card) {
      const outlet = card.querySelector('.coverage-outlet')?.textContent.trim() || '';
      if (!selected[outlet]) {
        card.remove();
        return;
      }

      const item = selected[outlet];
      const title = card.querySelector('h3');
      const desc = card.querySelector('p');
      const kind = card.querySelector('.coverage-kind');

      if (title) title.textContent = item.title;
      if (desc) desc.textContent = item.desc;
      if (kind) kind.textContent = 'Rio Verde';
      byOutlet.set(outlet, card);
    });

    order.forEach(function (outlet) {
      const card = byOutlet.get(outlet);
      if (card && grid) grid.appendChild(card);
    });

    const subtitles = Array.from(section.querySelectorAll('.media-subtitle'));
    const writtenSubtitle = subtitles.find(function (el) {
      return /cobertura escrita|rio verde na operação/i.test(el.textContent);
    });
    if (writtenSubtitle) writtenSubtitle.textContent = 'Rio Verde na Operação Simulatio';

    const note = section.querySelector('.coverage-note');
    if (note) note.textContent = 'Seleção de matérias com relação direta a Rio Verde, à Prefeitura e aos agentes públicos citados.';

    return videoReady;
  }

  if (applyFilter()) return;

  const observer = new MutationObserver(function () {
    if (applyFilter()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
