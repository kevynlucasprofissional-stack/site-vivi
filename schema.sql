-- Dados de denúncias privados e publicações editoriais. Nunca expor relatórios em APIs públicas.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  cover_url TEXT,
  body_delta TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_public ON articles(published, published_at DESC);


-- Credenciais editáveis no painel. O segredo HMAC permanece no Worker.
-- O registro ainda não existe até o primeiro ajuste no painel; inicialmente
-- o sistema valida as credenciais de bootstrap em secrets da Cloudflare.
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  username TEXT NOT NULL,
  email TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
