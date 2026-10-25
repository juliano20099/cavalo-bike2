import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Valores em dinheiro são guardados em CENTAVOS (inteiros) para evitar erros de arredondamento.
// Datas são guardadas como texto AAAA-MM-DD.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  sku TEXT,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  custo_unitario INTEGER NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  preco_venda INTEGER NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  ativo INTEGER NOT NULL DEFAULT 1,
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_produtos_sku ON produtos(sku) WHERE sku IS NOT NULL AND ativo = 1;

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  whatsapp INTEGER NOT NULL DEFAULT 0,
  email TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  bicicleta TEXT NOT NULL,
  defeito TEXT NOT NULL,
  servico_realizado TEXT NOT NULL DEFAULT '',
  mao_de_obra INTEGER NOT NULL DEFAULT 0 CHECK (mao_de_obra >= 0),
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','em_andamento','aguardando_peca','concluida','entregue','cancelada')),
  data_entrada TEXT NOT NULL,
  data_prevista TEXT,
  data_conclusao TEXT,
  observacoes TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS os_pecas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario INTEGER NOT NULL CHECK (preco_unitario >= 0),
  custo_unitario INTEGER NOT NULL CHECK (custo_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE RESTRICT,
  data TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL,
  desconto INTEGER NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  observacao TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venda_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario INTEGER NOT NULL CHECK (preco_unitario >= 0),
  custo_unitario INTEGER NOT NULL CHECK (custo_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  custo_unitario INTEGER NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  observacao TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  os_id INTEGER REFERENCES ordens_servico(id) ON DELETE SET NULL,
  venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor INTEGER NOT NULL CHECK (valor >= 0),
  data TEXT NOT NULL,
  observacao TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_mov_produto ON movimentacoes(produto_id, data);
CREATE INDEX IF NOT EXISTS ix_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS ix_os_status ON ordens_servico(status, data_entrada);
CREATE INDEX IF NOT EXISTS ix_gastos_data ON gastos(data);
`;

export function abrirBanco(caminho = './data/cavalo-bike.db') {
  if (caminho !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(caminho)), { recursive: true });
  const db = new Database(caminho);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
