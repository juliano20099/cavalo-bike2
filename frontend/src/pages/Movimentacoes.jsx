import { useState } from 'react';
import { api } from '../api.js';
import { reaisParaCentavos, hoje, formatarData, brl, MOTIVOS, MOTIVOS_MANUAIS } from '../utils.js';
import { Alerta, Badge, Campo, Estado, Vazio, Ajuda, useDados, useEnvio, useToast } from '../components/ui.jsx';

export default function Movimentacoes({ params }) {
  const toast = useToast();
  const produtos = useDados(() => api('/produtos'), []);
  const [filtro, setFiltro] = useState({ produto_id: '', tipo: '', de: '', ate: '' });
  const hist = useDados(() => api('/movimentacoes', { params: filtro }), [filtro.produto_id, filtro.tipo, filtro.de, filtro.ate]);
  const [f, setF] = useState({ produto_id: params?.produto_id ? String(params.produto_id) : '', tipo: 'entrada', quantidade: '1', custo: '', motivo: 'compra', data: hoje(), observacao: '' });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const escolhido = produtos.dados?.itens.find((p) => String(p.id) === f.produto_id);

  const trocarTipo = (e) => setF({ ...f, tipo: e.target.value, motivo: MOTIVOS_MANUAIS[e.target.value][0] });

  const registrar = (e) => {
    e.preventDefault();
    enviar(async () => {
      if (!f.produto_id) throw new Error('Escolha o produto.');
      const corpo = { produto_id: Number(f.produto_id), tipo: f.tipo, quantidade: Number(f.quantidade), motivo: f.motivo, data: f.data, observacao: f.observacao };
      if (f.tipo === 'entrada' && f.motivo === 'compra' && f.custo.trim() !== '') {
        const c = reaisParaCentavos(f.custo);
        if (Number.isNaN(c)) throw new Error('Informe o custo em reais, por exemplo 12,50.');
        corpo.custo_unitario = c;
      }
      await api('/movimentacoes', { method: 'POST', body: corpo });
      toast(f.tipo === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.');
      setF({ ...f, quantidade: '1', custo: '', observacao: '' });
      produtos.recarregar();
      hist.recarregar();
    });
  };

  return (
    <>
      <Ajuda titulo="Quando usar esta tela?">
        <p><b>Entrada:</b> chegou mercadoria (compra), cliente devolveu ou você encontrou diferença a mais no inventário. <b>Saída:</b> perda, quebra ou uso na própria loja.</p>
        <p>Vendas e ordens de serviço já dão baixa sozinhas. Ao informar o <b>custo</b> numa compra, o sistema recalcula o <b>custo médio</b> do produto. O histórico não é apagado: para corrigir um erro, registre um ajuste.</p>
      </Ajuda>

      <form className="painel-caixa form" onSubmit={registrar}>
        <h3>Registrar movimentação</h3>
        <Alerta erro={erro} />
        <div className="linha-campos">
          <Campo rotulo="Produto *">
            <select value={f.produto_id} onChange={mudar('produto_id')} required>
              <option value="">Selecione…</option>
              {(produtos.dados?.itens || []).map((p) => <option key={p.id} value={p.id}>{p.nome} (estoque: {p.quantidade})</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo *">
            <select value={f.tipo} onChange={trocarTipo}><option value="entrada">Entrada (+)</option><option value="saida">Saída (−)</option></select>
          </Campo>
          <Campo rotulo="Motivo *">
            <select value={f.motivo} onChange={mudar('motivo')}>{MOTIVOS_MANUAIS[f.tipo].map((m) => <option key={m} value={m}>{MOTIVOS[m]}</option>)}</select>
          </Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Quantidade *"><input type="number" min="1" step="1" value={f.quantidade} onChange={mudar('quantidade')} required /></Campo>
          {f.tipo === 'entrada' && f.motivo === 'compra' && (
            <Campo rotulo="Custo unitário (R$)" dica={escolhido ? `Custo atual: ${brl(escolhido.custo_unitario)}` : 'Opcional'}>
              <input inputMode="decimal" value={f.custo} onChange={mudar('custo')} placeholder="0,00" />
            </Campo>
          )}
          <Campo rotulo="Data *"><input type="date" value={f.data} onChange={mudar('data')} max={hoje()} required /></Campo>
        </div>
        <Campo rotulo="Observação"><input value={f.observacao} onChange={mudar('observacao')} maxLength={300} placeholder="Ex.: nota fiscal 123, fornecedor X" /></Campo>
        <div className="acoes"><button className="btn primario" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar'}</button></div>
      </form>

      <h2 className="secao">Histórico</h2>
      <div className="barra">
        <select value={filtro.produto_id} onChange={(e) => setFiltro({ ...filtro, produto_id: e.target.value })} aria-label="Filtrar por produto">
          <option value="">Todos os produtos</option>
          {(produtos.dados?.itens || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })} aria-label="Filtrar por tipo">
          <option value="">Entradas e saídas</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
        </select>
        <label className="check">De <input type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} /></label>
        <label className="check">Até <input type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} /></label>
      </div>
      <Estado dados={hist.dados} erro={hist.erro} onTentar={hist.recarregar}>
        {hist.dados && (hist.dados.length === 0 ? <Vazio texto="Nenhuma movimentação no filtro escolhido." /> : (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="num">Qtd.</th><th>Motivo</th><th>Observação</th></tr></thead>
            <tbody>
              {hist.dados.map((m) => (
                <tr key={m.id}>
                  <td data-label="Data">{formatarData(m.data)}</td>
                  <td data-label="Produto">{m.produto_nome}</td>
                  <td data-label="Tipo"><Badge cor={m.tipo === 'entrada' ? 'verde' : 'vermelho'}>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge></td>
                  <td data-label="Qtd." className="num">{m.tipo === 'entrada' ? '+' : '−'}{m.quantidade}</td>
                  <td data-label="Motivo">{MOTIVOS[m.motivo] || m.motivo}</td>
                  <td data-label="Observação">{m.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </Estado>
    </>
  );
}
