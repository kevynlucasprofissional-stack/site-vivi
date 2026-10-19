# Rio Verde Merece Saber — site-vivi

Site HTML/CSS/JavaScript publicado no Cloudflare Worker **acordarioverde**, que atende
rioverdemerecesaber.com e acordarioverde.com. Não usar Cloudflare Pages nem Lovable
para publicar este repositório.

## Funcionalidades

- Home: botão **Faça sua denúncia! Clique aqui** flutuante, animado suavemente e responsivo (respeita `prefers-reduced-motion`); feed das cinco notícias mais recentes e link para ver todas.
- /denuncia: formulário com nome, email, telefone, relato, consentimento e confirmação por protocolo.
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

## Desenvolvimento e testes

- npm install
- npm run db:local
- npm run dev
- npm test

Os endpoints POST exigem Origin igual ao domínio do site. O Turnstile é validado
no backend para denúncias públicas pelo Siteverify. O login administrativo não
exige Turnstile, utiliza senha forte e possui limite de 7 tentativas por 15 minutos
por identificador de IP via KV (controle de melhor esforço). O login usa PBKDF2-SHA256, 100.000 iterações (limite WebCrypto do Cloudflare Workers) e sal
aleatório, com sessão HMAC em cookie Secure/HttpOnly/SameSite=Strict por oito horas.
Dados administrativos exigem autenticação *no Worker*, não apenas no frontend.
Exportações de denúncias têm Cache-Control: no-store e limitação de 50.000 registros por arquivo.
O limitador de requisições via KV é de melhor esforço, pois KV tem consistência eventual;
para ataques persistentes, configurar também WAF e limites adicionais na Cloudflare.

## Privacidade

Denúncias nunca são expostas em APIs públicas nem publicadas no feed. O código
não salva relatos em cookies, analytics ou logs intencionais.

**Antes de divulgar publicamente o formulário**, definir a política de privacidade,
o responsável pelo tratamento de dados, canais para os titulares, prazo de retenção,
critérios de acesso/exclusão e procedimentos de resposta a incidentes (LGPD).
A descrição de finalidade presente no formulário não substitui essas definições.
Não pedir material sob sigilo judicial sem autorização e preservar a presunção de
inocência em todas as matérias publicadas.
