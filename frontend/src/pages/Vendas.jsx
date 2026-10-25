import { useState } from 'react';
import { api } from '../api.js';
import { brl, hoje, formatarData, reaisParaCentavos, centavosParaCampo, FORMAS_PAGAMENTO } from '../utils.js';
import { Alerta, Campo, Confirmar, Estado, Modal, SeloDemo, Vazio, Ajuda, useDados, useEnvio, useToast } from '../components/ui.jsx';

export default function Vendas() {
  const [filtro, setFiltro] = useState({ busca: '', de: '', ate: '' });
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const toast = useToast();
  const lista = useDados(() => api('/vendas', { params: filtro }), [filtro.busca, filtro.de, filtro.ate]);
  const mudarF = (k) => (e) => setFiltro({ ...filtro, [k]: e.target.value });
  const total = (lista.dados || []).reduce((s, v) => s + v.total, 0);

  const abrir = async (v) => { try { setDetalhe(await api(`/vendas/${v.id}`)); } catch (e) { toast(e.message, 'erro'); } };

  return (
    <>
      <Ajuda titulo="Para que serve?">
        <p>Registre aqui as <b>vendas de balcão</b> (peças e acessórios). Cada venda dá baixa no estoque e entra na receita do financeiro. Serviços da oficina são registrados em <b>Oficina (OS)</b>.</p>
      </Ajuda>
      <div className="barra">
        <input type="search" placeholder="Buscar por cliente ou nº da venda…" value={filtro.busca} onChange={mudarF('busca')} aria-label="Buscar venda" />
        <label className="check">De <input type="date" value={filtro.de} onChange={mudarF('de')} /></label>
        <label className="check">Até <input type="date" value={filtro.ate} onChange={mudarF('ate')} /></label>
        <button className="btn primario" onClick={() => setNovo(true)}>+ Nova venda</button>
      </div>
      <Estado dados={lista.dados} erro={lista.erro} onTentar={lista.recarregar}>
        {lista.dados && (lista.dados.length === 0 ? <Vazio texto="Nenhuma venda encontrada." /> : (
          <>
            <p className="muted">{lista.dados.length} venda(s) · total {brl(total)}</p>
            <table className="tabela">
              <thead><tr><th>Venda</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th className="num">Itens</th><th className="num">Total</th><th>Ações</th></tr></thead>
              <tbody>
                {lista.dados.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Venda">#{v.id} {v.demo ? <SeloDemo /> : null}</td>
                    <td data-label="Data">{formatarData(v.data)}</td>
                    <td data-label="Cliente">{v.cliente_nome || 'Cliente avulso'}</td>
                    <td data-label="Pagamento">{FORMAS_PAGAMENTO[v.forma_pagamento]}</td>
                    <td data-label="Itens" className="num">{v.qtd_itens}</td>
                    <td data-label="Total" className="num">{brl(v.total)}</td>
                    <td data-label="Ações" className="acoes-linha">
                      <button className="btn pequeno" onClick={() => abrir(v)}>Ver itens</button>
                      <button className="btn pequeno perigo-suave" onClick={() => setExcluindo(v)}>Cancelar venda</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))}
      </Estado>

      {novo && <FormVenda onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); toast('Venda registrada.'); lista.recarregar(); }} />}

      {detalhe && (
        <Modal titulo={`Venda #${detalhe.id}`} onFechar={() => setDetalhe(null)}>
          <p>{formatarData(detalhe.data)} · {FORMAS_PAGAMENTO[detalhe.forma_pagamento]} · {detalhe.cliente_nome || 'Cliente avulso'}</p>
          <table className="tabela">
            <thead><tr><th>Produto</th><th className="num">Qtd.</th><th className="num">Preço</th><th className="num">Subtotal</th></tr></thead>
            <tbody>{detalhe.itens.map((i) => <tr key={i.id}><td data-label="Produto">{i.produto_nome}</td><td data-label="Qtd." className="num">{i.quantidade}</td><td data-label="Preço" className="num">{brl(i.preco_unitario)}</td><td data-label="Subtotal" className="num">{brl(i.quantidade * i.preco_unitario)}</td></tr>)}</tbody>
          </table>
          {detalhe.desconto > 0 && <p>Desconto: −{brl(detalhe.desconto)}</p>}
          <p><b>Total: {brl(detalhe.total)}</b></p>
        </Modal>
      )}

      {excluindo && (
        <Confirmar titulo="Cancelar venda" rotuloSim="Cancelar venda" texto={`Cancelar a venda #${excluindo.id} (${brl(excluindo.total)})? Os itens voltam para o estoque e a receita é removida.`}
          onNao={() => setExcluindo(null)}
          onSim={async () => { await api(`/vendas/${excluindo.id}`, { method: 'DELETE' }); setExcluindo(null); toast('Venda cancelada.'); lista.recarregar(); }} />
      )}
    </>
  );
}

function FormVenda({ onFechar, onSalvo }) {
  const clientes = useDados(() => api('/clientes'), []);
  const produtos = useDados(() => api('/produtos'), []);
  const [f, setF] = useState({ cliente_id: '', data: hoje(), forma_pagamento: 'pix', desconto: '', observacao: '', itens: [{ produto_id: '', quantidade: '1', preco: '' }] });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const mudarItem = (i, campo, valor) => {
    const itens = f.itens.map((it, j) => (j === i ? { ...it, [campo]: valor } : it));
    if (campo === 'produto_id') {
      const p = produtos.dados?.itens.find((x) => String(x.id) === valor);
      if (p) itens[i].preco = centavosParaCampo(p.preco_venda);
    }
    setF({ ...f, itens });
  };
  const bruto = f.itens.reduce((s, it) => { const v = reaisParaCentavos(it.preco); return s + (Number.isNaN(v) ? 0 : v) * (Number(it.quantidade) || 0); }, 0);
  const desc = f.desconto.trim() === '' ? 0 : reaisParaCentavos(f.desconto);
  const total = bruto - (Number.isNaN(desc) ? 0 : desc);

  const salvar = (e) => {
    e.preventDefault();
    enviar(async () => {
      if (Number.isNaN(desc)) throw new Error('Informe o desconto em reais, por exemplo 5,00.');
      const itens = f.itens.map((it, i) => {
        const preco = reaisParaCentavos(it.preco);
        if (!it.produto_id) throw new Error(`Item ${i + 1}: escolha o produto.`);
        if (Number.isNaN(preco)) throw new Error(`Item ${i + 1}: informe o preço em reais.`);
        return { produto_id: Number(it.produto_id), quantidade: Number(it.quantidade), preco_unitario: preco };
      });
      await api('/vendas', { method: 'POST', body: { cliente_id: f.cliente_id ? Number(f.cliente_id) : null, data: f.data, forma_pagamento: f.forma_pagamento, desconto: desc, observacao: f.observacao, itens } });
      onSalvo();
    });
  };

  return (
    <Modal titulo="Nova venda" largo onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <Alerta erro={erro} />
        <div className="linha-campos">
          <Campo rotulo="Cliente (opcional)">
            <select value={f.cliente_id} onChange={mudar('cliente_id')}><option value="">Cliente avulso</option>{(clientes.dados || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          </Campo>
          <Campo rotulo="Data *"><input type="date" value={f.data} onChange={mudar('data')} max={hoje()} required /></Campo>
          <Campo rotulo="Pagamento *"><select value={f.forma_pagamento} onChange={mudar('forma_pagamento')}>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        </div>
        <fieldset className="pecas">
          <legend>Itens</legend>
          {f.itens.map((it, i) => (
            <div className="linha-peca" key={i}>
              <select value={it.produto_id} onChange={(e) => mudarItem(i, 'produto_id', e.target.value)} aria-label="Produto">
                <option value="">Escolha o produto…</option>
                {(produtos.dados?.itens || []).filter((x) => x.quantidade > 0).map((x) => <option key={x.id} value={x.id}>{x.nome} (estoque: {x.quantidade})</option>)}
              </select>
              <input type="number" min="1" step="1" value={it.quantidade} onChange={(e) => mudarItem(i, 'quantidade', e.target.value)} aria-label="Quantidade" />
              <input inputMode="decimal" value={it.preco} onChange={(e) => mudarItem(i, 'preco', e.target.value)} placeholder="Preço R$" aria-label="Preço unitário" />
              <button type="button" className="btn pequeno perigo-suave" disabled={f.itens.length === 1} onClick={() => setF({ ...f, itens: f.itens.filter((_, j) => j !== i) })}>Remover</button>
            </div>
          ))}
          <button type="button" className="btn pequeno" onClick={() => setF({ ...f, itens: [...f.itens, { produto_id: '', quantidade: '1', preco: '' }] })}>+ Adicionar item</button>
        </fieldset>
        <div className="linha-campos">
          <Campo rotulo="Desconto (R$)"><input inputMode="decimal" value={f.desconto} onChange={mudar('desconto')} placeholder="0,00" /></Campo>
          <div className="total-os">Itens: {brl(bruto)}<br /><strong>Total: {brl(total)}</strong></div>
        </div>
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Registrar venda'}</button>
        </div>
      </form>
    </Modal>
  );
}
