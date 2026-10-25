import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { login, autenticar } from './auth.js';
import { ErroNegocio } from './services/util.js';
import { produtosRouter } from './routes/produtos.js';
import { movimentacoesRouter } from './routes/movimentacoes.js';
import { clientesRouter } from './routes/clientes.js';
import { osRouter } from './routes/os.js';
import { vendasRouter } from './routes/vendas.js';
import { financeiroRouter, gastosRouter } from './routes/financeiro.js';
import { painelRouter } from './routes/painel.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));

export function tratarErros(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos. Corrija os campos e tente novamente.',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.') || 'geral', mensagem: i.message })),
    });
  }
  if (err instanceof ErroNegocio) return res.status(err.status).json({ erro: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Requisição inválida (JSON malformado).' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ erro: String(err.message).includes('sku') ? 'Já existe um produto ativo com este código (SKU).' : 'Já existe um registro igual a este.' });
  }
  if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ erro: 'Operação não permitida: o registro está em uso ou os dados violam uma regra do sistema.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno. Tente novamente; se persistir, avise o responsável pelo sistema.' });
}

export function criarApp(db, config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
    strictTransportSecurity: false, // a loja pode usar HTTP na rede local
  }));
  if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const limite = (max, janelaMin) => rateLimit({
    windowMs: janelaMin * 60_000, limit: max, standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde um pouco e tente novamente.' },
  });

  app.get('/api/saude', (req, res) => res.json({ ok: true }));
  app.post('/api/login', limite(20, 15), login(config));

  app.use('/api', limite(600, 1), autenticar(config));
  app.get('/api/sessao', (req, res) => res.json({ ok: true }));
  app.use('/api/produtos', produtosRouter(db));
  app.use('/api/movimentacoes', movimentacoesRouter(db));
  app.use('/api/clientes', clientesRouter(db));
  app.use('/api/os', osRouter(db));
  app.use('/api/vendas', vendasRouter(db));
  app.use('/api/gastos', gastosRouter(db));
  app.use('/api/financeiro', financeiroRouter(db));
  app.use('/api', painelRouter(db));
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  // Em produção o backend também entrega o frontend compilado (frontend/dist).
  const dist = path.resolve(aqui, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(tratarErros);
  return app;
}
