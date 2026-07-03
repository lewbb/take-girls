-- ============================================================
-- TAKE GIRLS — Schema do banco de dados PostgreSQL
-- Execute este arquivo uma vez para criar todas as tabelas
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Admins ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nome       VARCHAR(255) NOT NULL DEFAULT 'Admin',
  criado_em  TIMESTAMP DEFAULT NOW()
);

-- ─── Categorias ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id    SERIAL PRIMARY KEY,
  slug  VARCHAR(100) UNIQUE NOT NULL,
  nome  VARCHAR(100) NOT NULL,
  ordem INTEGER DEFAULT 0
);

INSERT INTO categorias (slug, nome, ordem) VALUES
  ('sets',       'Sets',       1),
  ('tops',       'Tops',       2),
  ('bottoms',    'Bottoms',    3),
  ('minis',      'Minis',      4),
  ('acessorios', 'Acessórios', 5)
ON CONFLICT (slug) DO NOTHING;

-- ─── Produtos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(255) NOT NULL,
  descricao     TEXT,
  emoji         VARCHAR(10) DEFAULT '👗',
  categoria_id  INTEGER REFERENCES categorias(id),
  preco         NUMERIC(10,2) NOT NULL,
  preco_promo   NUMERIC(10,2),
  estoque       INTEGER NOT NULL DEFAULT 0,
  tamanhos      TEXT[],           -- ex: '{P,M,G,GG}'
  status        VARCHAR(20) NOT NULL DEFAULT 'ativo'
                  CHECK (status IN ('ativo','pausado','esgotado')),
  destaque      BOOLEAN DEFAULT FALSE,
  badge         VARCHAR(20),      -- 'new' | 'sale' | null
  imagem_url    TEXT,
  criado_em     TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Atualiza atualizado_em automaticamente
CREATE OR REPLACE FUNCTION atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_produtos_timestamp
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION atualiza_timestamp();

-- ─── Promoções ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promocoes (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(255) NOT NULL,
  codigo      VARCHAR(50) UNIQUE,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('percentual','fixo','frete_gratis')),
  valor       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativa       BOOLEAN DEFAULT TRUE,
  validade    DATE,
  usos_max    INTEGER,
  usos_atual  INTEGER DEFAULT 0,
  criado_em   TIMESTAMP DEFAULT NOW()
);

INSERT INTO promocoes (nome, codigo, tipo, valor, ativa) VALUES
  ('Cupom 10% off', 'TAKE10', 'percentual', 10, true)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Clientes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  telefone   VARCHAR(20),
  criado_em  TIMESTAMP DEFAULT NOW()
);

-- ─── Endereços ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enderecos (
  id          SERIAL PRIMARY KEY,
  cliente_id  INTEGER REFERENCES clientes(id),
  cep         VARCHAR(9),
  rua         VARCHAR(255),
  numero      VARCHAR(20),
  complemento VARCHAR(100),
  bairro      VARCHAR(100),
  cidade      VARCHAR(100),
  uf          CHAR(2)
);

-- ─── Pedidos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20) UNIQUE NOT NULL DEFAULT 'TG'||LPAD(FLOOR(RANDOM()*999999)::TEXT,6,'0'),
  cliente_id      INTEGER REFERENCES clientes(id),
  endereco_id     INTEGER REFERENCES enderecos(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','pago','em_separacao','enviado','entregue','cancelado')),
  pagamento       VARCHAR(20) CHECK (pagamento IN ('pix','cartao','boleto')),
  subtotal        NUMERIC(10,2) NOT NULL,
  frete           NUMERIC(10,2) DEFAULT 0,
  desconto        NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  promocao_id     INTEGER REFERENCES promocoes(id),
  observacoes     TEXT,
  criado_em       TIMESTAMP DEFAULT NOW(),
  atualizado_em   TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER trg_pedidos_timestamp
BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION atualiza_timestamp();

-- ─── Itens do pedido ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedido_itens (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id  INTEGER REFERENCES produtos(id),
  nome_snapshot VARCHAR(255),   -- guarda o nome no momento da compra
  preco_snapshot NUMERIC(10,2), -- guarda o preço no momento da compra
  quantidade  INTEGER NOT NULL DEFAULT 1,
  tamanho     VARCHAR(10)
);

-- ─── Dados de exemplo ────────────────────────────────────────
INSERT INTO produtos (nome, descricao, emoji, categoria_id, preco, preco_promo, estoque, tamanhos, status, destaque, badge)
VALUES
  ('Set Velvet Roxo',    'Conjunto calça + top · P M G GG', '💜', 1, 279.00, NULL,   8,  '{P,M,G,GG}', 'ativo', true,  'new'),
  ('Top Corset Preto',   'Ajustável · PP P M G',             '🖤', 2, 129.00, NULL,   15, '{PP,P,M,G}', 'ativo', false, 'new'),
  ('Mini Saia Couro',    'PU · 36 38 40 42',                 '⚡', 4, 159.00, 139.00, 4,  '{36,38,40,42}', 'ativo', true, 'sale'),
  ('Wide Leg Roxo',      'Streetwear · 36 ao 44',            '🔮', 3, 209.00, NULL,   0,  '{36,38,40,42,44}', 'esgotado', false, NULL),
  ('Set Mesh Baddie',    'Top + saia · P M G',               '💎', 1, 239.00, 199.00, 6,  '{P,M,G}', 'ativo', true, 'sale'),
  ('Cinto Corrente',     'Prata e ouro · tamanho único',     '💫', 5, 89.00,  NULL,   20, '{unico}', 'ativo', false, 'new')
ON CONFLICT DO NOTHING;
