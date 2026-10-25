import { addDias } from './util.js';

/**
 * Regras do financeiro (explicadas também na tela):
 *  - Receita = vendas de balcão (já com desconto) + ordens de serviço CONCLUÍDAS/ENTREGUES (mão de obra + peças),
 *    contadas na data de conclusão.
 *  - Custo das peças (CMV) = custo unitário das peças no momento da venda/uso × quantidade.
 *  - Lucro bruto  = receita − custo das peças.
 *  - Lucro líquido = lucro bruto − gastos do período (aluguel, energia, etc.).
 *  - Comprar estoque NÃO é gasto: vira custo só quando a peça é vendida/usada.
 */
export function calcularResumo(db, de, ate) {
  const vendas = db.prepare(
    `SELECT v.id, v.data, v.total, v.forma_pagamento,
            COALESCE((SELECT SUM(quantidade * custo_unitario) FROM venda_itens WHERE venda_id = v.id), 0) AS cmv
     FROM vendas v WHERE v.data BETWEEN ? AND ?`,
  ).all(de, ate);

  const servicos = db.prepare(
    `SELECT o.id, o.data_conclusao AS data, o.mao_de_obra,
            COALESCE(SUM(p.quantidade * p.preco_unitario), 0) AS pecas,
            COALESCE(SUM(p.quantidade * p.custo_unitario), 0) AS cmv
     FROM ordens_servico o LEFT JOIN os_pecas p ON p.os_id = o.id
     WHERE o.status IN ('concluida','entregue') AND o.data_conclusao BETWEEN ? AND ?
     GROUP BY o.id`,
  ).all(de, ate);

  const gastos = db.prepare('SELECT id, data, descricao, categoria, valor FROM gastos WHERE data BETWEEN ? AND ?').all(de, ate);

  const soma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
  const r = {
    de, ate,
    receita_vendas: soma(vendas, (v) => v.total),
    custo_vendas: soma(vendas, (v) => v.cmv),
    qtd_vendas: vendas.length,
    receita_mao_de_obra: soma(servicos, (o) => o.mao_de_obra),
    receita_pecas_os: soma(servicos, (o) => o.pecas),
    custo_pecas_os: soma(servicos, (o) => o.cmv),
    qtd_os: servicos.length,
    gastos_total: soma(gastos, (g) => g.valor),
  };
  r.receita_servicos = r.receita_mao_de_obra + r.receita_pecas_os;
  r.receita_total = r.receita_vendas + r.receita_servicos;
  r.custo_total = r.custo_vendas + r.custo_pecas_os;
  r.lucro_bruto = r.receita_total - r.custo_total;
  r.lucro_liquido = r.lucro_bruto - r.gastos_total;
  r.margem_liquida = r.receita_total > 0 ? Math.round((r.lucro_liquido / r.receita_total) * 1000) / 10 : null;

  const porCat = new Map();
  for (const g of gastos) porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + g.valor);
  r.gastos_por_categoria = [...porCat].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);

  // Série para o gráfico: por dia (até ~2 meses) ou por mês.
  const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
  const chave = (data) => (dias <= 62 ? data : data.slice(0, 7));
  const serie = new Map();
  const ponto = (data) => {
    const k = chave(data);
    if (!serie.has(k)) serie.set(k, { chave: k, receita: 0, custo: 0, gastos: 0 });
    return serie.get(k);
  };
  for (const v of vendas) { const p = ponto(v.data); p.receita += v.total; p.custo += v.cmv; }
  for (const o of servicos) { const p = ponto(o.data); p.receita += o.mao_de_obra + o.pecas; p.custo += o.cmv; }
  for (const g of gastos) ponto(g.data).gastos += g.valor;
  r.serie = [...serie.values()].sort((a, b) => a.chave.localeCompare(b.chave))
    .map((p) => ({ ...p, lucro_liquido: p.receita - p.custo - p.gastos }));

  r.extrato = [
    ...vendas.map((v) => ({ data: v.data, tipo: 'venda', ref_id: v.id, descricao: `Venda #${v.id} (${v.forma_pagamento})`, receita: v.total, custo: v.cmv, gasto: 0 })),
    ...servicos.map((o) => ({ data: o.data, tipo: 'servico', ref_id: o.id, descricao: `Ordem de serviço #${o.id}`, receita: o.mao_de_obra + o.pecas, custo: o.cmv, gasto: 0 })),
    ...gastos.map((g) => ({ data: g.data, tipo: 'gasto', ref_id: g.id, descricao: `${g.descricao} (${g.categoria})`, receita: 0, custo: 0, gasto: g.valor })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.ref_id - a.ref_id);

  return r;
}

export { addDias };
