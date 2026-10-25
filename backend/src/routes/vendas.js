import { Router } from 'express';
import { z } from 'zod';
import { textoLivre, centavos, idRef, qtd, dataISO, idParam, like, periodo } from '../validators.js';
import { ErroNegocio, hoje } from '../services/util.js';
import { criarVenda, obterVenda, excluirVenda } from '../services/vendas.js';

export function vendasRouter(db) {
  const r = Router();
  const schema = z.object({
    cliente_id: idRef.nullish(),
    data: dataISO,
    forma_pagamento: z.enum(['dinheiro', 'pix', 'debito', 'credito', 'outro'], { errorMap: () => ({ message: 'Escolha a forma de pagamento.' }) }),
    desconto: centavos.default(0),
    observacao: textoLivre(300),
    itens: z.array(z.object({ produto_id: idRef, quantidade: qtd, preco_unitario: centavos })).min(1, 'Adicione pelo menos um item.').max(50),
  });

  r.get('/', (req, res) => {
    const [de, ate] = periodo(req.query, '0000-01-01', '9999-12-31');
    const args = [de, ate];
    let busca = '';
    if (req.query.busca) {
      busca = "AND (c.nome LIKE ? ESCAPE '\\' OR CAST(v.id AS TEXT) = ?)";
      args.push(like(req.query.busca), String(req.query.busca).replace('#', '').trim());
    }
    res.json(db.prepare(
      `SELECT v.*, c.nome AS cliente_nome,
              (SELECT COALESCE(SUM(quantidade), 0) FROM venda_itens WHERE venda_id = v.id) AS qtd_itens
       FROM vendas v LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE v.data BETWEEN ? AND ? ${busca} ORDER BY v.data DESC, v.id DESC LIMIT 500`,
    ).all(...args));
  });

  r.get('/:id', (req, res) => {
    const v = obterVenda(db, idParam(req));
    if (!v) throw new ErroNegocio('Venda não encontrada.', 404);
    res.json(v);
  });

  r.post('/', (req, res) => {
    const id = criarVenda(db, schema.parse(req.body));
    res.status(201).json(obterVenda(db, id));
  });

  r.delete('/:id', (req, res) => {
    excluirVenda(db, idParam(req), hoje());
    res.json({ ok: true });
  });

  return r;
}
