import { moverEstoque } from './estoque.js';
import { ErroNegocio, unirItens } from './util.js';

export function criarVenda(db, d, { demo = 0 } = {}) {
  return db.transaction(() => {
    if (d.cliente_id && !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(d.cliente_id)) {
      throw new ErroNegocio('Cliente não encontrado.', 404);
    }
    const itens = unirItens(d.itens);
    const bruto = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    if (d.desconto > bruto) throw new ErroNegocio('O desconto não pode ser maior que o total dos itens.');

    const id = Number(
      db.prepare(
        `INSERT INTO vendas (cliente_id, data, forma_pagamento, desconto, total, observacao, demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(d.cliente_id ?? null, d.data, d.forma_pagamento, d.desconto, bruto - d.desconto, d.observacao ?? '', demo)
        .lastInsertRowid,
    );

    for (const i of itens) {
      const mov = moverEstoque(db, {
        produto_id: i.produto_id, tipo: 'saida', quantidade: i.quantidade, motivo: 'venda',
        data: d.data, venda_id: id, observacao: `Venda #${id}`, demo,
      });
      db.prepare(
        'INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, custo_unitario) VALUES (?, ?, ?, ?, ?)',
      ).run(id, i.produto_id, i.quantidade, i.preco_unitario, mov.custo_unitario);
    }
    return id;
  })();
}

export function obterVenda(db, id) {
  const v = db.prepare(
    `SELECT v.*, c.nome AS cliente_nome FROM vendas v LEFT JOIN clientes c ON c.id = v.cliente_id WHERE v.id = ?`,
  ).get(id);
  if (!v) return null;
  v.itens = db.prepare(
    `SELECT i.*, p.nome AS produto_nome FROM venda_itens i JOIN produtos p ON p.id = i.produto_id
     WHERE i.venda_id = ? ORDER BY i.id`,
  ).all(id);
  return v;
}

/** Cancela a venda devolvendo os itens ao estoque. */
export function excluirVenda(db, id, hojeIso) {
  return db.transaction(() => {
    const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(id);
    if (!db.prepare('SELECT 1 FROM vendas WHERE id = ?').get(id)) throw new ErroNegocio('Venda não encontrada.', 404);
    for (const i of itens) {
      moverEstoque(db, {
        produto_id: i.produto_id, tipo: 'entrada', quantidade: i.quantidade, motivo: 'estorno_venda',
        data: hojeIso, observacao: `Cancelamento da venda #${id}`,
      });
    }
    db.prepare('DELETE FROM vendas WHERE id = ?').run(id);
  })();
}
