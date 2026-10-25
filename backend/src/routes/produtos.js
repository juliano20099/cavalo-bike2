import { Router } from 'express';
import { z } from 'zod';
import { txt, centavos, idParam, like } from '../validators.js';
import { moverEstoque } from '../services/estoque.js';
import { ErroNegocio, hoje } from '../services/util.js';

export function produtosRouter(db) {
  const r = Router();
  const base = z.object({
    nome: txt(120),
    sku: z.string().trim().max(40, 'Use no máximo 40 caracteres.').nullish().transform((v) => v || null),
    categoria: txt(60).default('Outros'),
    estoque_minimo: z.number({ invalid_type_error: 'Informe um número.' }).int('Use um número inteiro.').min(0).max(100000).default(0),
    custo_unitario: centavos,
    preco_venda: centavos,
  });
  const criar = base.extend({ quantidade: z.number({ invalid_type_error: 'Informe um número.' }).int('Use um número inteiro.').min(0).max(1000000).default(0) });

  const buscar = (id) => db.prepare(
    'SELECT *, quantidade * custo_unitario AS valor_estoque, (quantidade <= estoque_minimo) AS baixo FROM produtos WHERE id = ?',
  ).get(id);

  r.get('/categorias', (req, res) => {
    res.json(db.prepare('SELECT DISTINCT categoria FROM produtos WHERE ativo = 1 ORDER BY categoria').all().map((x) => x.categoria));
  });

  r.get('/', (req, res) => {
    const { busca, categoria, baixo } = req.query;
    const where = ['ativo = 1'];
    const args = [];
    if (busca) {
      where.push("(nome LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\')");
      args.push(like(busca), like(busca));
    }
    if (categoria) { where.push('categoria = ?'); args.push(String(categoria)); }
    if (baixo === '1') where.push('quantidade <= estoque_minimo');
    const itens = db.prepare(
      `SELECT *, quantidade * custo_unitario AS valor_estoque, (quantidade <= estoque_minimo) AS baixo
       FROM produtos WHERE ${where.join(' AND ')} ORDER BY nome COLLATE NOCASE`,
    ).all(...args);
    const resumo = db.prepare(
      `SELECT COUNT(*) AS total_produtos,
              COALESCE(SUM(quantidade * custo_unitario), 0) AS valor_total_estoque,
              COALESCE(SUM(quantidade * preco_venda), 0) AS valor_potencial_venda,
              COALESCE(SUM(quantidade <= estoque_minimo), 0) AS qtd_baixo
       FROM produtos WHERE ativo = 1`,
    ).get();
    res.json({ itens, resumo });
  });

  r.get('/:id', (req, res) => {
    const p = buscar(idParam(req));
    if (!p) throw new ErroNegocio('Produto não encontrado.', 404);
    res.json(p);
  });

  r.post('/', (req, res) => {
    const d = criar.parse(req.body);
    const id = db.transaction(() => {
      const novo = Number(db.prepare(
        'INSERT INTO produtos (nome, sku, categoria, estoque_minimo, custo_unitario, preco_venda) VALUES (?,?,?,?,?,?)',
      ).run(d.nome, d.sku, d.categoria, d.estoque_minimo, d.custo_unitario, d.preco_venda).lastInsertRowid);
      if (d.quantidade > 0) {
        moverEstoque(db, { produto_id: novo, tipo: 'entrada', quantidade: d.quantidade, motivo: 'estoque_inicial', data: hoje(), observacao: 'Cadastro do produto' });
      }
      return novo;
    })();
    res.status(201).json(buscar(id));
  });

  // A quantidade NÃO é editada aqui: use "Movimentações" para manter o histórico correto.
  r.put('/:id', (req, res) => {
    const id = idParam(req);
    const d = base.parse(req.body);
    const info = db.prepare(
      `UPDATE produtos SET nome=?, sku=?, categoria=?, estoque_minimo=?, custo_unitario=?, preco_venda=?,
       atualizado_em=datetime('now') WHERE id=? AND ativo=1`,
    ).run(d.nome, d.sku, d.categoria, d.estoque_minimo, d.custo_unitario, d.preco_venda, id);
    if (!info.changes) throw new ErroNegocio('Produto não encontrado.', 404);
    res.json(buscar(id));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const p = db.prepare('SELECT id FROM produtos WHERE id = ? AND ativo = 1').get(id);
    if (!p) throw new ErroNegocio('Produto não encontrado.', 404);
    const { n } = db.prepare(
      `SELECT (SELECT COUNT(*) FROM movimentacoes WHERE produto_id = @id)
            + (SELECT COUNT(*) FROM os_pecas WHERE produto_id = @id)
            + (SELECT COUNT(*) FROM venda_itens WHERE produto_id = @id) AS n`,
    ).get({ id });
    if (n === 0) {
      db.prepare('DELETE FROM produtos WHERE id = ?').run(id);
      return res.json({ ok: true, inativado: false });
    }
    // Já tem histórico: desativa (some das listas, histórico financeiro permanece correto).
    db.prepare("UPDATE produtos SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(id);
    res.json({ ok: true, inativado: true });
  });

  return r;
}
