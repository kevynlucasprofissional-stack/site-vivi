# Rio Verde Merece Saber — site-vivi

Site HTML/CSS/JavaScript publicado no Cloudflare Worker **acordarioverde**, que atende
rioverdemerecesaber.com e acordarioverde.com. Não usar Cloudflare Pages nem Lovable
para publicar este repositório.

## Funcionalidades

- Home: botão **Faça sua denúncia! Clique aqui** flutuante, animado suavemente e responsivo (respeita `prefers-reduced-motion`); feed das cinco notícias mais recentes e link para ver todas.
- /denuncia: apenas descrição livre e botão de envio; recebimento sem nome, telefone, e-mail ou captcha visível. Confirmação por protocolo.
- /noticias e /noticias/slug-da-materia: feed paginado e artigos completos.
- /admin: login administrativo, painel de denúncias, download CSV/JSON, edição e publicação de matérias, prévias desktop/mobile.
- Aba **Conta e segurança**: trocar nome de usuário, cadastrar e-mail de login e alterar senha pelo próprio painel, mediante senha atual. Sessões anteriores são revogadas; a sessão que confirma a mudança recebe novo cookie. O e-mail ainda não permite redefinição de senha.
- Editor Quill 2.0.3 vendorizado em public/vendor; imagens JPG/PNG/WebP de até 3 MB armazenadas em KV.
- Vídeos no corpo: incorporar vídeos HTTPS de YouTube/Vimeo ou selecionar um arquivo que o Chrome/Edge consiga decodificar (testados MP4, MOV/H.264 e WebM), converter no próprio navegador para WebM VP8/Opus e então enviar ao KV. Máximo: vídeo de origem até 500 MiB e 3 minutos, vídeo convertido até 15 MiB. **Não promete aceitar todos os formatos**: AVI/MPEG-4, codecs incomuns, arquivos corrompidos e conteúdo protegido podem não ser decodificados. Para esses casos, publicar via YouTube/Vimeo e incorporar por link.
- Vídeos em KV oferecem reprodução HTTP com suporte a Range e sem serviço de transcodificação pago.
- Backend em Cloudflare Workers, registros estruturados em D1.

## Configuração Cloudflare

Já foram criados na conta vinculada:
- D1 rioverde-editorial (ID configurado em wrangler.jsonc);
- KV rioverde-editorial-media (ID configurado em wrangler.jsonc);
- Turnstile Rio Verde Merece Saber - forms (sitekey em wrangler.jsonc);
- Secret TURNSTILE_SECRET adicionado ao Worker.

**Antes de colocar em produção:**
1. Rodar node scripts/prepare-admin.mjs e guardar senha/credenciais em local seguro.
2. Cadastrar os quatro secrets no Worker pelo painel Cloudflare (Settings > Variables and Secrets):
   ADMIN_USERNAME, ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_HASH e ADMIN_SESSION_SECRET.
   Nunca colocar os secrets no GitHub.
3. Confirmar que TURNSTILE_SECRET continua disponível ao Worker.
4. Fazer npx wrangler login no computador de publicação.
5. Executar npm install, npm test, npm run db:remote e npm run deploy.
6. Confirmar manualmente: homepage, envio de denúncia, login, exportação, publicação, preview, upload e controle de acesso.
7. Guardar com segurança a senha do administrador. Configurar backup, prazo de retenção e controle de acesso.

O schema.sql inicial já foi aplicado ao banco remoto via API. Ele é idempotente.

## Reparação do login administrativo

O Cloudflare Workers limita `crypto.subtle.deriveBits(PBKDF2)` a **100.000 iterações** por chamada. A implementação anterior usava 210.000 e não conseguia autenticar no ambiente de produção.

Depois de publicar a correção, executar `node scripts/repair-admin-login.mjs` no PowerShell na raiz do repositório. O script solicita a senha de forma oculta, calcula hash PBKDF2-SHA256 de 100.000 iterações com sal aleatório, atualiza somente o registro `admin_settings` no D1 remoto e apaga o arquivo SQL temporário. O nome de usuário permanece igual e as sessões anteriores são revogadas. Não copie a senha para comandos ou mensagens.

## Editor visual de imagens (ClassicPress 80/20)

O editor permanece no Quill 2 para evitar migrar dados já publicados. O fluxo visual se inspira nos controles de mídia do ClassicPress anexado: clique no ícone de imagem para enviar JPG/PNG/WebP até 3 MB e inserir a imagem na posição do cursor; clique na imagem para abrir uma barra contextual com tamanhos de 25%, 50%, 75% e 100%, alinhamentos à esquerda/centro/direita e opção Remover. Os atributos ficam no Delta (`width` e `imgAlign`) e são validados por allowlist no Worker, sem permitir estilos arbitrários ou URLs externas. As notícias públicas respeitam as configurações em desktop e mobile.

A implementação reutiliza Quill, D1 e KV existentes; não inclui o runtime PHP, nem o TinyMCE legado do ClassicPress. Testes: `scripts/integration.test.mjs` e testes reais locais no Chrome com Playwright.

## Gestão editorial (rascunhos, publicação e prévia)

- A lista **Notícias salvas** diferencia **Rascunho** de **Publicada**.
- Rascunhos: **Editar**, **Postar**, **Ver preview** e **Excluir**.
- Publicadas: **Editar**, **Ver preview** e **Excluir**. Ao editar uma notícia já publicada, o botão principal muda para **Atualizar** e mantém a publicação ativa.
- **Postar** publica uma matéria já salva sem precisar reabrir o editor.
- **Ver preview** abre `/admin/preview/?id=<UUID>`, com o mesmo renderizador da página pública `/noticias/:slug`, inclusive título, capa, imagens, vídeos e corpo. A API privada `GET /api/admin/news/:id` exige sessão administrativa; rascunhos nunca entram no feed público.
- **Excluir** remove a notícia do D1 depois de confirmação, fazendo a página pública retornar 404. Arquivos de mídia compartilháveis continuam no KV para não apagar imagens usadas em outras notícias (limpeza de arquivos órfãos fora do escopo 80/20).
- Somente **um preview de card** no editor, responsivo.

## Segurança dos testes e alertas GitGuardian

O arquivo `scripts/integration.test.mjs` é uma suíte de integração **exclusivamente
de teste**. Todas as credenciais explícitas nesse arquivo são **fixtures
fictícias**, criadas para validar caminhos de sucesso e erro da autenticação.
Ele executa o Worker localmente com dependências simuladas: SQLite
`:memory:`, KV em memória e configurações `ADMIN_*` de teste.
Os valores não são fornecidos pelo ambiente Cloudflare de produção e não
devem ser reutilizados como senhas, hashes ou chaves reais.

**Análise dos alertas GitGuardian em `scripts/integration.test.mjs`:**

| Ocorrência sinalizada | Finalidade no teste | Parecer sobre esta ocorrência |
| --- | --- | --- |
| Senha curta de exemplo | Conferir rejeição de senha nova insuficiente (HTTP 400) | Falso positivo para vazamento real |
| Senha incorreta de exemplo | Conferir rejeição de autenticação/credencial atual (HTTP 401/403) | Falso positivo para vazamento real |
| Host `rioverdemerecesaber.com` | Origem de `Request` simulada, não credencial | Falso positivo para segredo |
| Usuário genérico `admin` e número `200` | Identificador fictício e código de status HTTP | Falso positivo para segredo |

Os commits [`88a3228`](https://github.com/kevynlucasprofissional-stack/site-vivi/commit/88a32289551a3a17cb436e61701abc604bca4065) e
[`70544bb`](https://github.com/kevynlucasprofissional-stack/site-vivi/commit/70544bb0f19a17b8ce36a2a6b2da93206d7b528f)
contêm ocorrências identificadas pelo GitGuardian nos testes. A decisão técnica
é **classificar somente essas ocorrências específicas como falso positivo**,
após conferir arquivo, linha e contexto de cada incidente no painel. No painel GitGuardian, utilizar **Ignore** (não **Resolve**): selecionar
**Test credential** para as senhas fictícias e **False positive (not a secret)**
para host, nome de usuário e códigos HTTP que não constituem segredos.
O parecer documentado aqui **não altera automaticamente o status no GitGuardian**.

Esta exceção **não** se aplica a valores iguais ou semelhantes encontrados em
outros arquivos, branches, logs, variáveis reais, banco de dados ou ambiente de
produção. Não desabilitar o GitGuardian, o detector de credenciais ou a
varredura do repositório. Alterações futuras devem continuar sendo analisadas.

**Limite da verificação:** os segredos reais de autenticação são administrados
separadamente no Cloudflare Worker e/ou nas configurações administrativas do
D1. Esta análise dos testes **não garante** que a produção esteja configurada
corretamente. Verificar de forma independente a presença das variáveis
necessárias, a robustez das credenciais e a inexistência de reutilização de
senhas de teste, **sem imprimir ou versionar valores secretos**.

## Desenvolvimento e testes

- npm install
- npm run db:local
- npm run dev
- npm test

Os endpoints POST exigem Origin igual ao domínio do site. O formulário anônimo não usa Turnstile e limita a 3 envios por 15 minutos por impressão HMAC temporária do endereço IP (KV, sem registrar o IP bruto na tabela de denúncias). O login administrativo não exige Turnstile, utiliza senha forte e possui limite de 7 tentativas por 15 minutos
por identificador de IP via KV (controle de melhor esforço). O login usa PBKDF2-SHA256, 100.000 iterações (limite WebCrypto do Cloudflare Workers) e sal
aleatório, com sessão HMAC em cookie Secure/HttpOnly/SameSite=Strict por oito horas.
Dados administrativos exigem autenticação *no Worker*, não apenas no frontend.
Exportações de denúncias têm Cache-Control: no-store e limitação de 50.000 registros por arquivo.
O limitador de requisições via KV é de melhor esforço, pois KV tem consistência eventual;
para ataques persistentes, configurar também WAF e limites adicionais na Cloudflare.

## Privacidade

Denúncias não são expostas em APIs públicas nem publicadas no feed. Novos relatos armazenam somente protocolo, texto e data de envio no painel. A tabela legada mantém colunas obrigatórias de nome/contato preenchidas com valores fixos ou vazios; não registra nome, e-mail nem telefone dos denunciantes novos. Exportações e consultas administrativas expõem somente ID, texto e data. Dados pessoais de denúncias antigas são preservados no banco (não apagados automaticamente). Medidas de rede e segurança da Cloudflare ainda podem processar dados técnicos, inclusive IP; portanto anonimato de identificação no formulário não implica anonimato absoluto na rede.

**Antes de divulgar publicamente o formulário**, definir a política de privacidade,
o responsável pelo tratamento de dados, canais para os titulares, prazo de retenção,
critérios de acesso/exclusão e procedimentos de resposta a incidentes (LGPD).
A descrição de finalidade presente no formulário não substitui essas definições.
Não pedir material sob sigilo judicial sem autorização e preservar a presunção de
inocência em todas as matérias publicadas.
