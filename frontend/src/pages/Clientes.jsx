import { useState } from 'react';
import { api } from '../api.js';
import { brl, formatarData, formatarTelefone, linkWhatsApp, STATUS_OS, STATUS_COR } from '../utils.js';
import { Alerta, Badge, Campo, Confirmar, Estado, Modal, SeloDemo, Vazio, useDados, useEnvio, useToast } from '../components/ui.jsx';

const VAZIO = { nome: '', telefone: '', whatsapp: false, email: '', observacoes: '' };

export default function Clientes() {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [historico, setHistorico] = useState(null);
  const toast = useToast();
  const lista = useDados(() => api('/clientes', { params: { busca } }), [busca]);

  const verHistorico = async (c) => {
    try { setHistorico(await api(`/clientes/${c.id}/historico`)); } catch (e) { toast(e.message, 'erro'); }
  };

  return (
    <>
      <div className="barra">
        <input type="search" placeholder="Buscar por nome, telefone ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />
        <button className="btn primario" onClick={() => setEditando('novo')}>+ Novo cliente</button>
      </div>

      <Estado dados={lista.dados} erro={lista.erro} onTentar={lista.recarregar}>
        {lista.dados && (lista.dados.length === 0 ? <Vazio texto="Nenhum cliente encontrado." /> : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.dados.map((c) => (
                <tr key={c.id}>
                  <td data-label="Nome"><b>{c.nome}</b> {c.demo ? <SeloDemo /> : null}</td>
                  <td data-label="Telefone">
                    {c.telefone ? formatarTelefone(c.telefone) : '—'}{' '}
                    {c.whatsapp && c.telefone && !c.demo ? <a className="btn pequeno whats" href={linkWhatsApp(c.telefone)} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                    {c.whatsapp && c.demo ? <Badge cor="verde">WhatsApp</Badge> : null}
                  </td>
                  <td data-label="E-mail">{c.email || '—'}</td>
                  <td data-label="Ações" className="acoes-linha">
                    <button className="btn pequeno" onClick={() => verHistorico(c)}>Histórico</button>
                    <button className="btn pequeno" onClick={() => setEditando(c)}>Editar</button>
                    <button className="btn pequeno perigo-suave" onClick={() => setExcluindo(c)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </Estado>

      {editando && <FormCliente cliente={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)}
        onSalvo={() => { setEditando(null); toast('Cliente salvo.'); lista.recarregar(); }} />}

      {excluindo && (
        <Confirmar titulo="Excluir cliente" texto={`Excluir “${excluindo.nome}”? Clientes com ordens de serviço ou vendas no histórico não podem ser excluídos.`}
          onNao={() => setExcluindo(null)}
          onSim={async () => { await api(`/clientes/${excluindo.id}`, { method: 'DELETE' }); setExcluindo(null); toast('Cliente excluído.'); lista.recarregar(); }} />
      )}

      {historico && (
        <Modal titulo={`Histórico — ${historico.cliente.nome}`} largo onFechar={() => setHistorico(null)}>
          <p>Total em serviços concluídos e vendas: <b>{brl(historico.total_gasto)}</b></p>
          <h3>Ordens de serviço ({historico.ordens.length})</h3>
          {historico.ordens.length === 0 ? <Vazio texto="Nenhuma ordem de serviço." /> : (
            <table className="tabela">
              <thead><tr><th>OS</th><th>Bicicleta</th><th>Defeito</th><th>Entrada</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>{historico.ordens.map((o) => (
                <tr key={o.id}>
                  <td data-label="OS">#{o.id}</td><td data-label="Bicicleta">{o.bicicleta}</td><td data-label="Defeito">{o.defeito}</td>
                  <td data-label="Entrada">{formatarData(o.data_entrada)}</td>
                  <td data-label="Status"><Badge cor={STATUS_COR[o.status]}>{STATUS_OS[o.status]}</Badge></td>
                  <td data-label="Total" className="num">{brl(o.total)}</td>
                </tr>))}
              </tbody>
            </table>
          )}
          <h3>Compras no balcão ({historico.vendas.length})</h3>
          {historico.vendas.length === 0 ? <Vazio texto="Nenhuma venda." /> : (
            <table className="tabela">
              <thead><tr><th>Venda</th><th>Data</th><th>Pagamento</th><th className="num">Total</th></tr></thead>
              <tbody>{historico.vendas.map((v) => (
                <tr key={v.id}><td data-label="Venda">#{v.id}</td><td data-label="Data">{formatarData(v.data)}</td><td data-label="Pagamento">{v.forma_pagamento}</td><td data-label="Total" className="num">{brl(v.total)}</td></tr>))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  );
}

function FormCliente({ cliente, onFechar, onSalvo }) {
  const novo = !cliente;
  const [f, setF] = useState(novo ? VAZIO : { nome: cliente.nome, telefone: formatarTelefone(cliente.telefone) === '—' ? '' : formatarTelefone(cliente.telefone), whatsapp: Boolean(cliente.whatsapp), email: cliente.email, observacoes: cliente.observacoes });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = (e) => {
    e.preventDefault();
    enviar(async () => {
      await api(novo ? '/clientes' : `/clientes/${cliente.id}`, { method: novo ? 'POST' : 'PUT', body: f });
      onSalvo();
    });
  };
  return (
    <Modal titulo={novo ? 'Novo cliente' : 'Editar cliente'} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <Alerta erro={erro} />
        <Campo rotulo="Nome *"><input value={f.nome} onChange={mudar('nome')} required maxLength={120} autoFocus /></Campo>
        <div className="linha-campos">
          <Campo rotulo="Telefone (com DDD)"><input inputMode="tel" value={f.telefone} onChange={mudar('telefone')} placeholder="(81) 99999-0000" /></Campo>
          <Campo rotulo="E-mail"><input type="email" value={f.email} onChange={mudar('email')} maxLength={120} /></Campo>
        </div>
        <label className="check"><input type="checkbox" checked={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.checked })} /> Este número tem WhatsApp</label>
        <Campo rotulo="Observações"><textarea rows="3" value={f.observacoes} onChange={mudar('observacoes')} maxLength={500} /></Campo>
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
