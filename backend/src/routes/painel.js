import { Router } from 'express';
import { hoje } from '../services/util.js';
import { calcularResumo } from '../services/financeiro.js';
import { derivar } from '../services/os.js';
import { temDemo, carregarDemo, limparDemo } from '../services/demo.js';

export function painelRouter(db) {
  const r = Router();

  r.get('/painel', (req, res) => {
    const h = hoje();
    const mes = calcularResumo(db, `${h.slice(0, 8)}01`, h);
    const estoque = db.prepare(
      `SELECT COUNT(*) AS produtos, COALESCE(SUM(quantidade * custo_unitario), 0) AS valor_estoque,
              COALESCE(SUM(quantidade <= estoque_minimo), 0) AS qtd_baixo FROM produtos WHERE ativo = 1`,
    ).get();
    const baixo = db.prepare(
      `SELECT id, nome, quantidade, estoque_minimo FROM produtos
       WHERE ativo = 1 AND quantidade <= estoque_minimo ORDER BY (quantidade - estoque_minimo), nome LIMIT 8`,
    ).all();
    const porStatus = Object.fromEntries(
      db.prepare('SELECT status, COUNT(*) AS n FROM ordens_servico GROUP BY status').all().map((x) => [x.status, x.n]),
    );
    const atrasadas = db.prepare(
      `SELECT COUNT(*) AS n FROM ordens_servico
       WHERE data_prevista < ? AND status IN ('aberta','em_andamento','aguardando_peca')`,
    ).get(h).n;
    const recentes = db.prepare(
      `SELECT o.*, c.nome AS cliente_nome,
              COALESCE((SELECT SUM(quantidade * preco_unitario) FROM os_pecas WHERE os_id = o.id), 0) AS total_pecas
       FROM ordens_servico o JOIN clientes c ON c.id = o.cliente_id ORDER BY o.id DESC LIMIT 5`,
    ).all().map(derivar);
    res.json({
      mes: { de: mes.de, ate: mes.ate, receita_total: mes.receita_total, lucro_bruto: mes.lucro_bruto,
        lucro_liquido: mes.lucro_liquido, gastos_total: mes.gastos_total, qtd_vendas: mes.qtd_vendas, qtd_os: mes.qtd_os },
      estoque, baixo,
      os: { por_status: porStatus, em_aberto: (porStatus.aberta || 0) + (porStatus.em_andamento || 0) + (porStatus.aguardando_peca || 0), atrasadas },
      clientes: db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n,
      recentes,
      tem_demo: temDemo(db),
      vazio: db.prepare('SELECT (SELECT COUNT(*) FROM produtos) + (SELECT COUNT(*) FROM clientes) AS n').get().n === 0,
    });
  });

  r.post('/demo', (req, res) => { carregarDemo(db); res.status(201).json({ ok: true }); });
  r.delete('/demo', (req, res) => res.json({ ok: true, ...limparDemo(db) }));

  return r;
}
