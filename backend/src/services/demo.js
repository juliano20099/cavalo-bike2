import { moverEstoque } from './estoque.js';
import { criarVenda } from './vendas.js';
import { salvarOS } from './os.js';
import { ErroNegocio, addDias, hoje } from './util.js';

/**
 * DADOS DE DEMONSTRAÇÃO — valores ilustrativos, SEM relação com a loja real.
 * Todos os registros ficam marcados com demo = 1, aparecem com selo "DEMO" na tela
 * e podem ser removidos de uma vez (limparDemo).
 */
export function temDemo(db) {
  return db.prepare(
    `SELECT (SELECT COUNT(*) FROM produtos WHERE demo=1) + (SELECT COUNT(*) FROM clientes WHERE demo=1) AS n`,
  ).get().n > 0;
}

export function carregarDemo(db) {
  if (temDemo(db)) throw new ErroNegocio('Os dados de demonstração já estão carregados.', 409);
  const h = hoje();
  db.transaction(() => {
    const produtos = [
      ['DEMO-001', 'Câmara de ar aro 29', 'Câmaras e pneus', 1800, 3500, 5, 12],
      ['DEMO-002', 'Pneu 29 x 2.10', 'Câmaras e pneus', 6500, 12000, 4, 8],
      ['DEMO-003', 'Corrente 9 velocidades', 'Transmissão', 4200, 8900, 3, 6],
      ['DEMO-004', 'Pastilha de freio (par)', 'Freios', 1500, 3500, 6, 4],
      ['DEMO-005', 'Cabo de câmbio', 'Transmissão', 600, 1800, 5, 10],
      ['DEMO-006', 'Óleo lubrificante 100 ml', 'Lubrificantes', 1200, 2800, 4, 2],
      ['DEMO-007', 'Manopla (par)', 'Acessórios', 1400, 3200, 3, 7],
      ['DEMO-008', 'Capacete adulto', 'Acessórios', 5500, 11900, 2, 5],
      ['DEMO-009', 'Câmbio traseiro', 'Transmissão', 9000, 18900, 2, 3],
      ['DEMO-010', 'Luz dianteira LED', 'Acessórios', 2500, 5900, 3, 0],
    ];
    const ids = produtos.map(([sku, nome, categoria, custo, preco, minimo, compra]) => {
      const id = Number(db.prepare(
        `INSERT INTO produtos (nome, sku, categoria, estoque_minimo, custo_unitario, preco_venda, demo) VALUES (?,?,?,?,?,?,1)`,
      ).run(nome, sku, categoria, minimo, custo, preco).lastInsertRowid);
      if (compra > 0) {
        moverEstoque(db, { produto_id: id, tipo: 'entrada', quantidade: compra, custo_unitario: custo, motivo: 'compra',
          data: addDias(h, -25), observacao: 'Compra de demonstração', demo: 1 });
      }
      return id;
    });

    const cli = ['A', 'B', 'C', 'D'].map((l) => Number(db.prepare(
      `INSERT INTO clientes (nome, telefone, whatsapp, observacoes, demo) VALUES (?, '00000000000', ?, 'Registro de demonstração', 1)`,
    ).run(`Cliente Demonstração ${l}`, l === 'A' || l === 'C' ? 1 : 0).lastInsertRowid));

    const venda = (dias, c, forma, itens, desconto = 0) => criarVenda(db, {
      cliente_id: c, data: addDias(h, -dias), forma_pagamento: forma, desconto, observacao: 'Venda de demonstração',
      itens: itens.map(([i, q]) => ({ produto_id: ids[i], quantidade: q, preco_unitario: produtos[i][4] })),
    }, { demo: 1 });
    venda(20, null, 'pix', [[0, 2], [4, 1]]);
    venda(14, cli[0], 'dinheiro', [[7, 1]], 500);
    venda(9, null, 'debito', [[1, 1], [0, 1]]);
    venda(5, cli[2], 'credito', [[6, 2], [5, 1]]);
    venda(2, null, 'pix', [[3, 2]]);

    const os = (c, bike, defeito, servico, mao, status, entrada, prev, concl, pecas) => salvarOS(db, null, {
      cliente_id: cli[c], bicicleta: bike, defeito, servico_realizado: servico, mao_de_obra: mao, status,
      data_entrada: addDias(h, -entrada), data_prevista: prev == null ? null : addDias(h, prev),
      data_conclusao: concl == null ? null : addDias(h, -concl), observacoes: 'OS de demonstração',
      pecas: pecas.map(([i, q]) => ({ produto_id: ids[i], quantidade: q, preco_unitario: produtos[i][4] })),
    }, { demo: 1 });
    os(0, 'Bike aro 29 (demonstração)', 'Corrente pulando', 'Troca de corrente e regulagem', 6000, 'entregue', 12, -9, 10, [[2, 1]]);
    os(1, 'Bike urbana (demonstração)', 'Freio sem força', 'Troca de pastilhas e sangria', 5000, 'concluida', 5, -2, 3, [[3, 1]]);
    os(2, 'Mountain bike (demonstração)', 'Câmbio desregulado', '', 4000, 'em_andamento', 2, 3, null, [[4, 2]]);
    os(3, 'Bike infantil (demonstração)', 'Pneu furado', '', 2000, 'aguardando_peca', 4, -1, null, []);

    const gasto = (dias, descricao, categoria, valor) => db.prepare(
      'INSERT INTO gastos (descricao, categoria, valor, data, observacao, demo) VALUES (?,?,?,?,?,1)',
    ).run(descricao, categoria, valor, addDias(h, -dias), 'Gasto de demonstração');
    gasto(20, 'Aluguel do ponto', 'Aluguel', 120000);
    gasto(15, 'Conta de energia', 'Energia', 18000);
    gasto(12, 'Internet', 'Internet', 9900);
    gasto(8, 'Ferramentas', 'Ferramentas', 15000);
    gasto(3, 'Panfletos', 'Marketing', 5000);
  })();
}

export function limparDemo(db) {
  return db.transaction(() => {
    db.prepare('DELETE FROM vendas WHERE demo = 1').run();
    db.prepare('DELETE FROM ordens_servico WHERE demo = 1').run();
    db.prepare('DELETE FROM movimentacoes WHERE demo = 1').run();
    db.prepare('DELETE FROM gastos WHERE demo = 1').run();
    const p = db.prepare(
      `DELETE FROM produtos WHERE demo = 1
       AND NOT EXISTS (SELECT 1 FROM movimentacoes WHERE produto_id = produtos.id)
       AND NOT EXISTS (SELECT 1 FROM os_pecas WHERE produto_id = produtos.id)
       AND NOT EXISTS (SELECT 1 FROM venda_itens WHERE produto_id = produtos.id)`,
    ).run().changes;
    const c = db.prepare(
      `DELETE FROM clientes WHERE demo = 1
       AND NOT EXISTS (SELECT 1 FROM ordens_servico WHERE cliente_id = clientes.id)
       AND NOT EXISTS (SELECT 1 FROM vendas WHERE cliente_id = clientes.id)`,
    ).run().changes;
    return { produtos_removidos: p, clientes_removidos: c };
  })();
}
