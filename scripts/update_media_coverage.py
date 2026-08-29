from pathlib import Path
import re
from html import escape

p = Path('public/index.html')
s = p.read_text(encoding='utf-8')

# Corrige a área de acesso ao processo: remove o Drive e usa apenas a consulta oficial.
new_process = '''  <!-- Destaque processo judicial -->
  <div class="container" style="padding-top: 36px; padding-bottom: 0;">
    <div class="processo-box" id="processo">
      <span class="badge">⚠ Fonte oficial</span>
      <h2>Consulte o processo diretamente no TJGO</h2>
      <p style="font-size:.95rem; color:#78350f; margin-bottom:4px;">
        A disponibilidade dos autos e documentos depende das regras de acesso do próprio Tribunal. Use o número abaixo na consulta oficial.
      </p>
      <div class="processo-numero">5990208-61.2025.8.09.0051</div>
      <div class="processo-botoes">
        <a href="https://projudi.tjgo.jus.br/BuscaProcesso?PaginaAtual=4" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          Consultar processo no TJGO (Projudi) →
        </a>
      </div>
      <p class="processo-nota">
        Decisão judicial de 12/05/2026 — 1º Juízo das Garantias de Goiânia. O documento-fonte consultado está identificado como sigiloso; por isso, esta página não redistribui o PDF integral.
      </p>
    </div>
  </div>
'''
s, n = re.subn(
    r'\s*<!-- Destaque processo judicial -->.*?(?=\s*<!-- Documentos do processo -->)',
    '\n' + new_process + '\n',
    s,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f'process block matches: {n}')

s = s.replace(
    'Trechos de documentos públicos do processo judicial. Toque na imagem para ampliar.',
    'Trechos documentais já reunidos nesta página editorial. O acesso integral aos autos depende das regras do TJGO. Toque na imagem para ampliar.',
)

new_docs_download = '''      <div class="docs-download">
        <p>Para consultar os autos completos e verificar a disponibilidade de documentos, utilize a fonte oficial do Tribunal de Justiça de Goiás.</p>
        <a href="https://projudi.tjgo.jus.br/BuscaProcesso?PaginaAtual=4" target="_blank" rel="noopener noreferrer" class="btn btn-download" style="width:100%; max-width:400px;">
          Consultar processo no TJGO →
        </a>
        <p style="font-size:12px; color:#64748b; margin-top:10px; margin-bottom:0;">O PDF integral não é redistribuído por esta página porque o documento-fonte está identificado como sigiloso.</p>
      </div>'''
s, n = re.subn(r'\s*<div class="docs-download">.*?</div>', '\n' + new_docs_download, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'docs download matches: {n}')

coverage_css = '''
    /* ── Repercussão na imprensa ── */
    .media-subtitle {
      font-size: 14px;
      font-weight: 800;
      color: var(--text);
      margin: 28px 0 12px;
    }

    .coverage-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .coverage-card {
      display: block;
      background: var(--bg);
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px 16px;
      text-decoration: none;
      color: var(--text);
      transition: border-color .15s, transform .1s, box-shadow .15s;
    }

    .coverage-card:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
      box-shadow: var(--shadow);
    }

    .coverage-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 5px;
    }

    .coverage-outlet {
      font-size: 14px;
      font-weight: 800;
    }

    .coverage-kind {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--accent);
      background: #fee2e2;
      border-radius: 999px;
      padding: 3px 7px;
      white-space: nowrap;
    }

    .coverage-card h3 {
      font-size: .92rem;
      line-height: 1.35;
      margin-bottom: 4px;
    }

    .coverage-card p {
      font-size: 12px;
      line-height: 1.45;
      color: var(--muted);
    }

    .coverage-note {
      font-size: 12px;
      color: #64748b;
      margin-top: 14px;
      line-height: 1.5;
    }

    .video-links-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .video-source-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #111827;
      color: #fff;
      text-decoration: none;
      border-radius: 10px;
      padding: 14px 16px;
      transition: transform .1s, opacity .15s;
    }

    .video-source-card:hover {
      transform: translateY(-1px);
      opacity: .94;
    }

    .video-source-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--accent);
      font-size: 16px;
      flex: 0 0 auto;
    }

    .video-source-card strong {
      display: block;
      font-size: 14px;
      line-height: 1.3;
    }

    .video-source-card span span {
      display: block;
      font-size: 12px;
      color: #d1d5db;
      margin-top: 2px;
    }

    @media (min-width: 600px) {
      .coverage-grid { grid-template-columns: repeat(2, 1fr); }
      .video-links-grid { grid-template-columns: repeat(2, 1fr); }
    }

'''
if '/* ── Repercussão na imprensa ── */' not in s:
    s = s.replace('    /* ── Linha do tempo ── */', coverage_css + '    /* ── Linha do tempo ── */')

video_section = '''  <!-- Vídeos -->
  <section id="videos">
    <div class="container">
      <p class="section-label">Repercussão na imprensa</p>
      <h2 class="section-title">Vídeos, pronunciamentos e cobertura jornalística</h2>
      <p class="lead">Reunimos abaixo a cobertura pública verificada sobre a Operação Simulatio. Onde há vídeo ou pronunciamento público, o acesso aparece primeiro; em seguida estão as matérias escritas de diferentes veículos.</p>

      <div class="video-grid">
        <div class="video-card">
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/DYK_Ft74V9g" title="Reportagem Sucesso no Campo — Operação Simulatio" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
          <div class="video-info">
            <span class="video-tag">Sucesso no Campo · 12/08/2026</span>
            <h3>Fraude em licitação — reportagem sobre a Operação Simulatio</h3>
            <p>Reportagem com imagens da operação em Rio Verde e trechos da coletiva da Prefeitura.</p>
          </div>
        </div>
      </div>

      <p class="media-subtitle">Vídeos e pronunciamentos publicados por outros meios</p>
      <div class="video-links-grid">
        <a class="video-source-card" href="https://jornalfolhadenoticias.com.br/apos-operacao-do-ministerio-publico-prefeito-de-rio-verde-realiza-coletiva-defende-transparencia-e-esclarece-investigacao/" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>Folha de Notícias</strong><span>Coletiva do prefeito de Rio Verde após a operação</span></span></a>
        <a class="video-source-card" href="https://portalnoticiasgoias.com.br/rio-verde-carrijo-ressalta-que-operacao-simulatio-mira-empresa/" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>Portal Notícias Goiás</strong><span>Cobertura em vídeo da coletiva em Rio Verde</span></span></a>
        <a class="video-source-card" href="https://www.tvgmulti.com.br/noticia/3290/goiatuba/goias/secretaria-de-educacao-de-itaberai-diz-que-operacao-do-mpgo-mira-empresa-que-atuou-na-escola-sao-dimas.html" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>TVG Multi</strong><span>Pronunciamento da Secretaria de Educação de Itaberaí</span></span></a>
        <a class="video-source-card" href="https://www.gynnoticias.com.br/goias/secretario-de-educacao-de-goianesia-explica-envolvimento-do-municipio-na-operacao-simulatio/3502" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>GYN Notícias</strong><span>Pronunciamento do secretário de Educação de Goianésia</span></span></a>
        <a class="video-source-card" href="https://www.instagram.com/reel/Db833aqKX2O/" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>Instagram</strong><span>Registro do cumprimento de mandados</span></span></a>
        <a class="video-source-card" href="https://www.instagram.com/reel/Db8DkGGRMsp/" target="_blank" rel="noopener noreferrer"><span class="video-source-icon">▶</span><span><strong>Instagram</strong><span>Repercussão da Operação Simulatio</span></span></a>
      </div>

      <p class="media-subtitle">Cobertura escrita verificada</p>
      <div class="coverage-grid">
'''

coverage = [
    ('Jornal Somos', 'Rio Verde', 'Prefeitura esclarece ação do Ministério Público na coleta de documentos', '11/08/2026 · cobertura local e coletiva da Prefeitura.', 'https://jornalsomos.com.br/categoria/cultura-e-entretenimento/detalhe/prefeitura-de-rio-verde-esclarece-acao-do-ministerio-publico-na-coleta-de-documentos'),
    ('GYN Notícias', 'Política', 'Prefeitura de Rio Verde diz que operação não tem servidores do município como alvo', '11/08/2026 · posicionamento da administração municipal.', 'https://www.gynnoticias.com.br/politica/prefeitura-de-rio-verde-diz-que-operacao-simulatio-nao-tem-servidores-do-municipio-como-alvo/3513'),
    ('Jornal Opção', 'Goiás', 'Investigados e medidas da Operação Simulatio', '11/08/2026 · detalhamento dos investigados e das medidas judiciais.', 'https://www.jornalopcao.com.br/ultimas-noticias/saiba-quem-sao-os-investigados-em-operacao-do-mp-que-apura-supostas-fraudes-em-contratos-que-causou-prejuizo-de-r-14-milhoes-856424/'),
    ('Opa News', 'Contratos', 'Empresa alvo e contratos públicos em diferentes municípios', '11/08/2026 · inclui referência a contrato com Rio Verde.', 'https://www.opanoticias.com.br/noticia/empresa-alvo-da-operacao-simulatio-e-a-mesma-que-recebeu-r-6-6-milhoes-da-prefeitura-de-formosa-por-adesao-de-atas'),
    ('Folha de Notícias', 'Rio Verde', 'Prefeito realiza coletiva após operação do Ministério Público', '11/08/2026 · cobertura da manifestação da Prefeitura.', 'https://jornalfolhadenoticias.com.br/apos-operacao-do-ministerio-publico-prefeito-de-rio-verde-realiza-coletiva-defende-transparencia-e-esclarece-investigacao/'),
    ('Folha no Sudoeste', 'Local', 'Rio Verde é alvo de operação contra supostas fraudes em licitações', '11/08/2026 · cobertura regional das diligências.', 'https://www.folhanosudoeste.com.br/investigacao-rio-verde-e-alvo-de-operacao-contra-supostas-fraudes-em-licitacoes'),
    ('Portal Notícias Goiás', 'Entrevista', 'Carrijo ressalta que Operação Simulatio mira empresa', '11/08/2026 · coletiva e posicionamento da gestão municipal.', 'https://portalnoticiasgoias.com.br/rio-verde-carrijo-ressalta-que-operacao-simulatio-mira-empresa/'),
    ('Olha Goiás', 'Política', 'Prefeito de Rio Verde nega envolvimento em operação', '11/08/2026 · repercussão da coletiva de imprensa.', 'https://www.olhagoias.com.br/politica/prefeito-de-rio-verde-nega-envolvimento-em-operaca'),
    ('RVC FM', 'Rádio', 'Operação investiga fraudes e cumpre mandados em cidades goianas', '11/08/2026 · cobertura regional e registro das diligências.', 'https://www.rvcfm.com.br/noticias/cidades/15912-operacao-do-mp-investiga-fraudes-em-licitacoes-e-cumpre-mandados-em-goianesia-e-outras-cidades'),
    ('TVG Multi', 'Vídeo', 'Secretária de Educação de Itaberaí se pronuncia sobre a operação', '12/08/2026 · matéria com vídeo de esclarecimento.', 'https://www.tvgmulti.com.br/noticia/3290/goiatuba/goias/secretaria-de-educacao-de-itaberai-diz-que-operacao-do-mpgo-mira-empresa-que-atuou-na-escola-sao-dimas.html'),
    ('O Hoje', 'Estado', 'Operação do MP-GO mira fraude estimada em R$ 14 milhões', '12/08/2026 · panorama estadual da investigação.', 'https://ohoje.com/2026/08/12/operacao-do-mp-go-mira-fraude-de-r-14-milhoes-em-goias/'),
    ('Diário de Goiás', 'Estado', 'Suposto esquema envolvendo empresas e órgãos públicos é alvo do MPGO', '12/08/2026 · operação, prisões e afastamentos.', 'https://diariodegoias.com.br/suposto-esquema-de-fraudes-em-licitacoes-envolvendo-empresas-e-orgaos-publicos-e-alvo-do-mpgo/543811/'),
    ('PortalGO', 'Justiça', 'MPGO combate fraude em licitações de salas modulares', '12/08/2026 · explicação do modelo investigado.', 'https://portalgo.com.br/justica/mpgo-combate-fraude-de-r-14-milhoes-em-licitacoes-de-salas-modulares'),
    ('Folha1GO', 'Goiás', 'Operação Simulatio investiga fraude de R$ 14 milhões', '11/08/2026 · resumo da operação com informações do MPGO.', 'https://folha1go.com.br/operacao-simulatio-mpgo-investiga-fraude-de-r-14-milhoes-em-licitacoes/'),
    ('Dia Online', 'Notícia', 'MP de Goiás deflagra operação contra suposto esquema de fraudes', '11/08/2026 · síntese da investigação e das medidas.', 'https://diaonline.ig.com.br/2026/08/11/mp-de-goias-deflagra-operacao-contra-suposto-esquema-de-fraudes-em-licitacoes/'),
    ('TVSD Notícias', 'Notícia', 'MP-GO deflagra operação contra suposto esquema em licitações', '11/08/2026 · mandados, prisões e afastamentos.', 'https://tvsdnoticias.com.br/mp-go-deflagra-operacao-contra-suposto-esquema-de-fraudes-em-licitacoes-que-teria-causado-prejuizo-de-r-14-milhoes/'),
    ('Portal 6', 'Goiás', 'Grupo suspeito de fraudar licitações é alvo do MPGO', '11/08/2026 · abrangência da operação em Goiás e São Paulo.', 'https://portal6.com.br/2026/08/11/mpgo-deflagra-operacao-contra-grupo-suspeito-de-fraudar-licitacoes-e-causar-prejuizo-de-mais-de-r-14-milhoes/'),
    ('RGO News', 'Goiás', 'Gaepp deflagra Operação Simulatio', '11/08/2026 · grupo empresarial e servidores públicos entre os alvos.', 'https://rgonews.com.br/noticia/225/mpgo-gaepp-deflagra-operacao-simulatio-contra-suposto-esquema-de-fraudes-em-licitacoes'),
    ('Cerrado News', 'Justiça', 'MPGO investiga suposta fraude com prejuízo superior a R$ 14 milhões', '11/08/2026 · panorama das medidas e valores investigados.', 'https://www.c2news.com.br/noticia/operacao-simulatio-mpgo-investiga-suposta-fraude-em-licitacoes-com-prejuizo-superior-a-r-14-milhoes'),
    ('Transmissão Política', 'Política', 'MPGO deflagra operação contra suposto esquema em licitações', '11/08/2026 · resumo da operação e dos contratos investigados.', 'https://transmissaopolitica.com.br/politica-goiana/2026/08/11/operacao-simulatio-fraudes-licitacoes-goias/'),
]

for outlet, kind, title, desc, url in coverage:
    video_section += (
        f'        <a class="coverage-card" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">'
        f'<div class="coverage-top"><span class="coverage-outlet">{escape(outlet)}</span>'
        f'<span class="coverage-kind">{escape(kind)}</span></div>'
        f'<h3>{escape(title)}</h3><p>{escape(desc)}</p></a>\n'
    )

video_section += '''      </div>
      <p class="coverage-note">Levantamento feito em fontes públicas e atualizado em 29/08/2026. A lista reúne os veículos encontrados e verificados nesta pesquisa, mas pode não ser exaustiva. A inclusão de uma matéria indica apenas que o veículo publicou conteúdo sobre o caso, não endosso editorial desta página.</p>
    </div>
  </section>
'''

s, n = re.subn(
    r'\s*<!-- Vídeos -->.*?(?=\s*<!-- Linha do tempo simplificada -->)',
    '\n' + video_section + '\n',
    s,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f'video section matches: {n}')

s = s.replace('<strong>Última atualização:</strong> 18/08/2026', '<strong>Última atualização:</strong> 29/08/2026')
s = s.replace('baseado em documentos e fontes oficiais públicas. Não é', 'baseado em fontes oficiais e cobertura jornalística pública. Não é')
s = s.replace(
    '<li>Apenas informações públicas foram divulgadas, em respeito à LGPD.</li>',
    '<li>O PDF integral identificado como sigiloso não é redistribuído; a consulta aos autos deve ser feita pelos canais oficiais do TJGO.</li>',
)

for forbidden in ['11rPvp1Qwe0jn6RVDJICu00kThPRfnTQ-', 'enquanto ainda é público', 'não está em segredo de justiça']:
    if forbidden in s:
        raise SystemExit('texto antigo ainda presente: ' + forbidden)

if 'Jornal Opção' not in s or s.count('coverage-card') < 20:
    raise SystemExit('cobertura não inserida corretamente')

p.write_text(s, encoding='utf-8')
