import { useState } from 'react';
import { api } from '../api.js';
import { brl, hoje, formatarData, formatarTelefone, linkWhatsApp, reaisParaCentavos, centavosParaCampo, STATUS_OS, STATUS_COR } from '../utils.js';
import { Alerta, Badge, Campo, Cartao, Confirmar, Estado, Modal, SeloDemo, Vazio, Ajuda, useDados, useEnvio, useToast } from '../components/ui.jsx';

export default function OrdensServico() {
  const [filtro, setFiltro] = useState({ busca: '', status: '', de: '', ate: '' });
  const [editando, setEditando] = useState(null); // 'novo' | OS completa
  const [excluindo, setExcluindo] = useState(null);
  const toast = useToast();
  const lista = useDados(() => api('/os', { params: filtro }), [filtro.busca, filtro.status, filtro.de, filtro.ate]);
  const mudarF = (k) => (e) => setFiltro({ ...filtro, [k]: e.target.value });

  const abrir = async (o) => {
    try { setEditando(await api(`/os/${o.id}`)); } catch (e) { toast(e.message, 'erro'); }
  };
  const trocarStatus = async (o, status) => {
    try { await api(`/os/${o.id}/status`, { method: 'PATCH', body: { status } }); toast(`OS #${o.id}: ${STATUS_OS[status]}.`); lista.recarregar(); }
    catch (e) { toast(e.message, 'erro'); lista.recarregar(); }
  };

  const itens = lista.dados || [];
  return (
    <>
      <Ajuda titulo="Como funcionam as ordens de serviço?">
        <p>Registre a bicicleta, o <b>defeito relatado</b> e depois o <b>serviço realizado</b>. As <b>peças</b> escolhidas saem do estoque ao salvar (se você editar ou cancelar a OS, o estoque é ajustado). O <b>valor total</b> é mão de obra + peças.</p>
        <p>A receita da OS só entra no financeiro quando o status for <b>Concluída</b> ou <b>Entregue</b>, na data de conclusão.</p>
      </Ajuda>

      <div className="grade-cartoes">
        <Cartao rotulo="Em aberto" valor={itens.filter((o) => ['aberta', 'em_andamento', 'aguardando_peca'].includes(o.status)).length} detalhe="na lista abaixo" />
        <Cartao rotulo="Atrasadas" valor={itens.filter((o) => o.atrasada).length} tom={itens.some((o) => o.atrasada) ? 'alerta' : ''} />
      </div>

      <div className="barra">
        <input type="search" placeholder="Buscar cliente, bicicleta, defeito ou nº…" value={filtro.busca} onChange={mudarF('busca')} aria-label="Buscar OS" />
        <select value={filtro.status} onChange={mudarF('status')} aria-label="Status">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_OS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="check">De <input type="date" value={filtro.de} onChange={mudarF('de')} /></label>
        <label className="check">Até <input type="date" value={filtro.ate} onChange={mudarF('ate')} /></label>
        <button className="btn primario" onClick={() => setEditando('novo')}>+ Nova OS</button>
      </div>

      <Estado dados={lista.dados} erro={lista.erro} onTentar={lista.recarregar}>
        {lista.dados && (itens.length === 0 ? <Vazio texto="Nenhuma ordem de serviço encontrada." /> : (
          <table className="tabela">
            <thead><tr><th>OS</th><th>Cliente</th><th>Bicicleta / defeito</th><th>Entrada</th><th>Previsão</th><th>Status</th><th className="num">Total</th><th>Ações</th></tr></thead>
            <tbody>
              {itens.map((o) => (
                <tr key={o.id} className={o.atrasada ? 'linha-alerta' : ''}>
                  <td data-label="OS">#{o.id} {o.demo ? <SeloDemo /> : null}</td>
                  <td data-label="Cliente">{o.cliente_nome}{o.whatsapp && o.telefone && !o.demo ? <> <a className="btn pequeno whats" href={linkWhatsApp(o.telefone)} target="_blank" rel="noreferrer">WhatsApp</a></> : null}<br /><small className="muted">{o.telefone ? formatarTelefone(o.telefone) : ''}</small></td>
                  <td data-label="Bicicleta / defeito"><b>{o.bicicleta}</b><br /><small className="muted">{o.defeito}</small></td>
                  <td data-label="Entrada">{formatarData(o.data_entrada)}</td>
                  <td data-label="Previsão">{formatarData(o.data_prevista)} {o.atrasada ? <Badge cor="vermelho">Atrasada</Badge> : null}</td>
                  <td data-label="Status">
                    <select className={`status-select ${STATUS_COR[o.status]}`} value={o.status} onChange={(e) => trocarStatus(o, e.target.value)} aria-label={`Status da OS ${o.id}`}>
                      {Object.entries(STATUS_OS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td data-label="Total" className="num">{brl(o.total)}</td>
                  <td data-label="Ações" className="acoes-linha">
                    <button className="btn pequeno" onClick={() => abrir(o)}>Abrir / editar</button>
                    <button className="btn pequeno perigo-suave" onClick={() => setExcluindo(o)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </Estado>

      {editando && <FormOS os={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)}
        onSalvo={() => { setEditando(null); toast('Ordem de serviço salva.'); lista.recarregar(); }} />}

      {excluindo && (
        <Confirmar titulo="Excluir ordem de serviço" texto={`Excluir a OS #${excluindo.id} de ${excluindo.cliente_nome}? As peças usadas voltam para o estoque e a receita (se houver) deixa de contar.`}
          onNao={() => setExcluindo(null)}
          onSim={async () => { await api(`/os/${excluindo.id}`, { method: 'DELETE' }); setExcluindo(null); toast('OS excluída.'); lista.recarregar(); }} />
      )}
    </>
  );
}

function FormOS({ os, onFechar, onSalvo }) {
  const novo = !os;
  const clientes = useDados(() => api('/clientes'), []);
  const produtos = useDados(() => api('/produtos'), []);
  const [f, setF] = useState(novo ? {
    cliente_id: '', bicicleta: '', defeito: '', servico_realizado: '', mao_de_obra: '', status: 'aberta',
    data_entrada: hoje(), data_prevista: '', data_conclusao: '', observacoes: '', pecas: [],
  } : {
    cliente_id: String(os.cliente_id), bicicleta: os.bicicleta, defeito: os.defeito, servico_realizado: os.servico_realizado,
    mao_de_obra: centavosParaCampo(os.mao_de_obra), status: os.status, data_entrada: os.data_entrada, data_prevista: os.data_prevista || '',
    data_conclusao: os.data_conclusao || '', observacoes: os.observacoes,
    pecas: os.pecas.map((p) => ({ produto_id: String(p.produto_id), quantidade: String(p.quantidade), preco: centavosParaCampo(p.preco_unitario) })),
  });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const final = ['concluida', 'entregue'].includes(f.status);

  const mudarPeca = (i, campo, valor) => {
    const pecas = f.pecas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p));
    if (campo === 'produto_id') {
      const prod = produtos.dados?.itens.find((x) => String(x.id) === valor);
      if (prod) pecas[i].preco = centavosParaCampo(prod.preco_venda);
    }
    setF({ ...f, pecas });
  };
  const totalPecas = f.pecas.reduce((s, p) => { const v = reaisParaCentavos(p.preco); return s + (Number.isNaN(v) ? 0 : v) * (Number(p.quantidade) || 0); }, 0);
  const mao = reaisParaCentavos(f.mao_de_obra || '0');
  const total = totalPecas + (Number.isNaN(mao) ? 0 : mao);

  const salvar = (e) => {
    e.preventDefault();
    enviar(async () => {
      if (!f.cliente_id) throw new Error('Escolha o cliente.');
      if (Number.isNaN(mao)) throw new Error('Informe a mão de obra em reais, por exemplo 40,00.');
      const pecas = f.pecas.map((p, i) => {
        const preco = reaisParaCentavos(p.preco);
        if (!p.produto_id) throw new Error(`Peça ${i + 1}: escolha o produto.`);
        if (Number.isNaN(preco)) throw new Error(`Peça ${i + 1}: informe o preço em reais.`);
        return { produto_id: Number(p.produto_id), quantidade: Number(p.quantidade), preco_unitario: preco };
      });
      const corpo = {
        cliente_id: Number(f.cliente_id), bicicleta: f.bicicleta, defeito: f.defeito, servico_realizado: f.servico_realizado,
        mao_de_obra: mao, status: f.status, data_entrada: f.data_entrada, data_prevista: f.data_prevista || null,
        data_conclusao: final ? f.data_conclusao || null : null, observacoes: f.observacoes, pecas,
      };
      await api(novo ? '/os' : `/os/${os.id}`, { method: novo ? 'POST' : 'PUT', body: corpo });
      onSalvo();
    });
  };

  return (
    <Modal titulo={novo ? 'Nova ordem de serviço' : `Ordem de serviço #${os.id}`} largo onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <Alerta erro={erro} />
        <div className="linha-campos">
          <Campo rotulo="Cliente *">
            <select value={f.cliente_id} onChange={mudar('cliente_id')} required>
              <option value="">Selecione…</option>
              {(clientes.dados || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Status *"><select value={f.status} onChange={mudar('status')}>{Object.entries(STATUS_OS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        </div>
        <Campo rotulo="Bicicleta *" dica="Modelo, cor, aro… para identificar na oficina."><input value={f.bicicleta} onChange={mudar('bicicleta')} required maxLength={120} /></Campo>
        <Campo rotulo="Defeito relatado pelo cliente *"><textarea rows="2" value={f.defeito} onChange={mudar('defeito')} required maxLength={1000} /></Campo>
        <Campo rotulo="Serviço realizado"><textarea rows="2" value={f.servico_realizado} onChange={mudar('servico_realizado')} maxLength={1000} /></Campo>
        <div className="linha-campos">
          <Campo rotulo="Data de entrada *"><input type="date" value={f.data_entrada} onChange={mudar('data_entrada')} required /></Campo>
          <Campo rotulo="Previsão de entrega"><input type="date" value={f.data_prevista} onChange={mudar('data_prevista')} min={f.data_entrada} /></Campo>
          {final && <Campo rotulo="Data de conclusão" dica="Vazio = hoje."><input type="date" value={f.data_conclusao} onChange={mudar('data_conclusao')} /></Campo>}
        </div>

        <fieldset className="pecas">
          <legend>Peças usadas (saem do estoque ao salvar)</legend>
          {f.pecas.length === 0 && <p className="muted">Nenhuma peça adicionada.</p>}
          {f.pecas.map((p, i) => (
            <div className="linha-peca" key={i}>
              <select value={p.produto_id} onChange={(e) => mudarPeca(i, 'produto_id', e.target.value)} aria-label="Peça">
                <option value="">Escolha a peça…</option>
                {(produtos.dados?.itens || []).map((x) => <option key={x.id} value={x.id}>{x.nome} (estoque: {x.quantidade})</option>)}
              </select>
              <input type="number" min="1" step="1" value={p.quantidade} onChange={(e) => mudarPeca(i, 'quantidade', e.target.value)} aria-label="Quantidade" />
              <input inputMode="decimal" value={p.preco} onChange={(e) => mudarPeca(i, 'preco', e.target.value)} placeholder="Preço R$" aria-label="Preço unitário" />
              <button type="button" className="btn pequeno perigo-suave" onClick={() => setF({ ...f, pecas: f.pecas.filter((_, j) => j !== i) })}>Remover</button>
            </div>
          ))}
          <button type="button" className="btn pequeno" onClick={() => setF({ ...f, pecas: [...f.pecas, { produto_id: '', quantidade: '1', preco: '' }] })}>+ Adicionar peça</button>
        </fieldset>

        <div className="linha-campos">
          <Campo rotulo="Mão de obra (R$)"><input inputMode="decimal" value={f.mao_de_obra} onChange={mudar('mao_de_obra')} placeholder="0,00" /></Campo>
          <div className="total-os">Peças: {brl(totalPecas)}<br /><strong>Total da OS: {brl(total)}</strong></div>
        </div>
        <Campo rotulo="Observações"><input value={f.observacoes} onChange={mudar('observacoes')} maxLength={1000} /></Campo>
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar OS'}</button>
        </div>
      </form>
    </Modal>
  );
}
