// Testes de API: sobem o servidor com um banco em memória (nada é gravado em disco).
// Execute com: npm test --prefix backend
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.js';
import { criarApp } from '../src/app.js';
import { hoje } from '../src/services/util.js';

const config = { senha: 'senha-de-teste', jwtSecret: 'segredo-de-teste', corsOrigin: null };
let servidor, base, token;

async function chamar(metodo, caminho, corpo, comToken = true) {
  const resp = await fetch(`${base}/api${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(comToken && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: resp.status, corpo: await resp.json().catch(() => null) };
}

before(async () => {
  const app = criarApp(abrirBanco(':memory:'), config);
  await new Promise((ok) => { servidor = app.listen(0, '127.0.0.1', ok); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

test('exige login e rejeita senha errada', async () => {
  assert.equal((await chamar('GET', '/produtos', null, false)).status, 401);
  assert.equal((await chamar('POST', '/login', { senha: 'errada' }, false)).status, 401);
  const ok = await chamar('POST', '/login', { senha: config.senha }, false);
  assert.equal(ok.status, 200);
  token = ok.corpo.token;
  assert.equal((await chamar('GET', '/sessao')).status, 200);
});

test('valida dados do produto', async () => {
  const r = await chamar('POST', '/produtos', { nome: '', custo_unitario: -1, preco_venda: 'abc' });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.detalhes.length >= 2);
});

let produtoId;
test('cadastra produto, controla entradas/saídas e alerta de estoque baixo', async () => {
  const novo = await chamar('POST', '/produtos', { nome: 'Câmara aro 29', sku: 'T-1', custo_unitario: 1000, preco_venda: 2500, estoque_minimo: 3, quantidade: 5 });
  assert.equal(novo.status, 201);
  produtoId = novo.corpo.id;
  assert.equal(novo.corpo.valor_estoque, 5000);
  assert.equal((await chamar('POST', '/produtos', { nome: 'Outro', sku: 'T-1', custo_unitario: 1, preco_venda: 2 })).status, 409);

  const saida = await chamar('POST', '/movimentacoes', { produto_id: produtoId, tipo: 'saida', quantidade: 3, motivo: 'perda' });
  assert.equal(saida.status, 201);
  const lista = await chamar('GET', '/produtos?baixo=1');
  assert.equal(lista.corpo.itens.length, 1);
  assert.equal(lista.corpo.itens[0].quantidade, 2);

  const demais = await chamar('POST', '/movimentacoes', { produto_id: produtoId, tipo: 'saida', quantidade: 50, motivo: 'perda' });
  assert.equal(demais.status, 409);
  const invalido = await chamar('POST', '/movimentacoes', { produto_id: produtoId, tipo: 'entrada', quantidade: 1, motivo: 'perda' });
  assert.equal(invalido.status, 400);

  await chamar('POST', '/movimentacoes', { produto_id: produtoId, tipo: 'entrada', quantidade: 8, motivo: 'compra', custo_unitario: 1000 });
  assert.equal((await chamar('GET', `/produtos/${produtoId}`)).corpo.quantidade, 10);
});

test('ordem de serviço baixa peças, devolve ao cancelar e protege cliente com histórico', async () => {
  const cli = await chamar('POST', '/clientes', { nome: 'Cliente de teste', telefone: '(81) 90000-0000', whatsapp: true });
  assert.equal(cli.status, 201);
  assert.equal(cli.corpo.telefone, '81900000000');
  assert.equal((await chamar('POST', '/clientes', { nome: 'X', telefone: '123' })).status, 400);

  const corpo = {
    cliente_id: cli.corpo.id, bicicleta: 'Aro 29 preta', defeito: 'Pneu furado', servico_realizado: 'Troca de câmara',
    mao_de_obra: 4000, status: 'concluida', data_entrada: hoje(),
    pecas: [{ produto_id: produtoId, quantidade: 2, preco_unitario: 2500 }],
  };
  const os = await chamar('POST', '/os', corpo);
  assert.equal(os.status, 201);
  assert.equal(os.corpo.total, 9000);
  assert.equal((await chamar('GET', `/produtos/${produtoId}`)).corpo.quantidade, 8);

  await chamar('PATCH', `/os/${os.corpo.id}/status`, { status: 'cancelada' });
  assert.equal((await chamar('GET', `/produtos/${produtoId}`)).corpo.quantidade, 10);

  assert.equal((await chamar('DELETE', `/clientes/${cli.corpo.id}`)).status, 409);
  assert.equal((await chamar('DELETE', `/os/${os.corpo.id}`)).status, 200);
  assert.equal((await chamar('DELETE', `/clientes/${cli.corpo.id}`)).status, 200);
});

test('financeiro: vendas, serviços, gastos, lucro bruto e líquido', async () => {
  const antes = (await chamar('GET', `/financeiro/resumo?de=${hoje()}&ate=${hoje()}`)).corpo;
  assert.equal(antes.receita_total, 0);

  const venda = await chamar('POST', '/vendas', {
    data: hoje(), forma_pagamento: 'pix', desconto: 500, itens: [{ produto_id: produtoId, quantidade: 2, preco_unitario: 2500 }],
  });
  assert.equal(venda.status, 201);
  assert.equal(venda.corpo.total, 4500);
  assert.equal((await chamar('POST', '/vendas', { data: hoje(), forma_pagamento: 'pix', desconto: 0, itens: [] })).status, 400);

  const cli = (await chamar('POST', '/clientes', { nome: 'Outro cliente' })).corpo;
  await chamar('POST', '/os', {
    cliente_id: cli.id, bicicleta: 'Urbana', defeito: 'Freio', mao_de_obra: 3000, status: 'entregue', data_entrada: hoje(),
    pecas: [{ produto_id: produtoId, quantidade: 1, preco_unitario: 2500 }],
  });
  const gasto = await chamar('POST', '/gastos', { descricao: 'Energia', categoria: 'Energia', valor: 1000, data: hoje() });
  assert.equal(gasto.status, 201);

  const r = (await chamar('GET', `/financeiro/resumo?de=${hoje()}&ate=${hoje()}`)).corpo;
  assert.equal(r.receita_total, 4500 + 5500);
  assert.equal(r.custo_total, 2000 + 1000);
  assert.equal(r.lucro_bruto, 7000);
  assert.equal(r.lucro_liquido, 6000);

  // cancelar a venda devolve ao estoque e zera a receita de vendas
  assert.equal((await chamar('DELETE', `/vendas/${venda.corpo.id}`)).status, 200);
  assert.equal((await chamar('GET', `/financeiro/resumo?de=${hoje()}&ate=${hoje()}`)).corpo.receita_vendas, 0);
});

test('dados de demonstração podem ser carregados e removidos', async () => {
  assert.equal((await chamar('POST', '/demo')).status, 201);
  assert.equal((await chamar('POST', '/demo')).status, 409);
  const painel = (await chamar('GET', '/painel')).corpo;
  assert.equal(painel.tem_demo, true);
  assert.equal((await chamar('DELETE', '/demo')).status, 200);
  assert.equal((await chamar('GET', '/painel')).corpo.tem_demo, false);
});

test('rotas inexistentes e ids inválidos retornam erros claros', async () => {
  assert.equal((await chamar('GET', '/nada')).status, 404);
  assert.equal((await chamar('GET', '/produtos/abc')).status, 400);
  assert.equal((await chamar('GET', '/produtos/99999')).status, 404);
});