import { ErroNegocio, hoje } from './util.js';

/**
 * ÚNICO ponto do sistema que altera a quantidade em estoque.
 * Toda entrada/saída (manual, venda, ordem de serviço, estorno) passa por aqui,
 * atualizando o produto e gravando o histórico (movimentacoes) juntos.
 * Chame sempre dentro de uma transação quando houver mais de uma operação.
 */
export function moverEstoque(db, m) {
  const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(m.produto_id);
  if (!p) throw new ErroNegocio('Produto não encontrado.', 404);

  if (m.tipo === 'saida') {
    if (!p.ativo) throw new ErroNegocio(`O produto "${p.nome}" está desativado.`, 409);
    if (p.quantidade < m.quantidade) {
      throw new ErroNegocio(
        `Estoque insuficiente de "${p.nome}": há ${p.quantidade} e foram pedidos ${m.quantidade}.`,
        409,
      );
    }
  }

  const novaQtd = p.quantidade + (m.tipo === 'entrada' ? m.quantidade : -m.quantidade);
  let novoCusto = p.custo_unitario;
  let custoMov = p.custo_unitario;

  // Compra com custo informado: recalcula o CUSTO MÉDIO ponderado do produto.
  if (m.tipo === 'entrada' && m.motivo === 'compra' && m.custo_unitario != null) {
    custoMov = m.custo_unitario;
    novoCusto = Math.round((p.quantidade * p.custo_unitario + m.quantidade * m.custo_unitario) / novaQtd);
  }

  db.prepare("UPDATE produtos SET quantidade = ?, custo_unitario = ?, atualizado_em = datetime('now') WHERE id = ?")
    .run(novaQtd, novoCusto, p.id);

  const info = db.prepare(
    `INSERT INTO movimentacoes (produto_id, tipo, quantidade, custo_unitario, motivo, observacao, data, os_id, venda_id, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(p.id, m.tipo, m.quantidade, custoMov, m.motivo, m.observacao ?? '', m.data ?? hoje(),
    m.os_id ?? null, m.venda_id ?? null, m.demo ?? 0);

  return { id: Number(info.lastInsertRowid), custo_unitario: custoMov, quantidade_atual: novaQtd };
}
