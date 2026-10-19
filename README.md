# Rio Verde Merece Saber — site-vivi

Site HTML/CSS/JavaScript publicado no Cloudflare Worker **acordarioverde**, que atende
rioverdemerecesaber.com e acordarioverde.com. Não usar Cloudflare Pages nem Lovable
para publicar este repositório.

## Funcionalidades

- Home: botão **Faça sua denúncia! Clique aqui**, feed das cinco notícias mais recentes e link para ver todas.
- /denuncia: formulário com nome, email, telefone, relato, consentimento e confirmação por protocolo.
- /noticias e /noticias/slug-da-materia: feed paginado e artigos completos.
- /admin: login administrativo, painel de denúncias, download CSV/JSON, edição e publicação de matérias, prévias desktop/mobile.
- Editor Quill 2.0.3 vendorizado em public/vendor; imagens JPG/PNG/WebP de até 3 MB armazenadas em KV.
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

## Desenvolvimento e testes

- npm install
- npm run db:local
- npm run dev
- npm test

Os endpoints POST exigem Origin igual ao domínio do site. O Turnstile é validado
no backend pelo Siteverify. O login usa PBKDF2-SHA256, 210.000 iterações e sal
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
