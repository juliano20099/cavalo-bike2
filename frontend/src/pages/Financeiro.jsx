import { useState } from 'react';
import { api } from '../api.js';
import { brl, hoje, addDias, inicioDoMes, inicioDoAno, formatarData, reaisParaCentavos, centavosParaCampo } from '../utils.js';
import { Alerta, Badge, Campo, Cartao, Confirmar, Estado, Modal, SeloDemo, Vazio, Ajuda, useDados, useEnvio, useToast } from '../components/ui.jsx';

const PRESETS = [
  ['Hoje', () => [hoje(), hoje()]],
  ['Últimos 7 dias', () => [addDias(hoje(), -6), hoje()]],
  ['Este mês', () => [inicioDoMes(), hoje()]],
  ['Este ano', () => [inicioDoAno(), hoje()]],
];
const TIPOS = { venda: ['Venda', 'azul'], servico: ['Serviço', 'verde'], gasto: ['Gasto', 'vermelho'] };

export default function Financeiro() {
  const [[de, ate], setPeriodo] = useState([inicioDoMes(), hoje()]);
  const [aba, setAba] = useState('resumo');
  const resumo = useDados(() => api('/financeiro/resumo', { params: { de, ate } }), [de, ate]);
  const gastos = useDados(() => api('/gastos', { params: { de, ate } }), [de, ate]);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const toast = useToast();
  const periodoInvalido = de > ate;

  const atualizar = () => { resumo.recarregar(); gastos.recarregar(); };

  return (
    <>
      <div className="barra">
        {PRESETS.map(([nome, fn]) => <button key={nome} className="btn pequeno" onClick={() => setPeriodo(fn())}>{nome}</button>)}
        <label className="check">De <input type="date" value={de} onChange={(e) => e.target.value && setPeriodo([e.target.value, ate])} /></label>
        <label className="check">Até <input type="date" value={ate} onChange={(e) => e.target.value && setPeriodo([de, e.target.value])} /></label>
      </div>
      {periodoInvalido && <div className="alerta">A data inicial não pode ser depois da final.</div>}

      <div className="abas" role="tablist">
        {[['resumo', 'Resumo'], ['extrato', 'Lançamentos'], ['gastos', 'Gastos']].map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>

      {aba === 'resumo' && (
        <Estado dados={periodoInvalido ? null : resumo.dados} erro={resumo.erro} onTentar={resumo.recarregar}>
          {resumo.dados && <Resumo r={resumo.dados} />}
        </Estado>
      )}

      {aba === 'extrato' && (
        <Estado dados={resumo.dados} erro={resumo.erro} onTentar={resumo.recarregar}>
          {resumo.dados && (resumo.dados.extrato.length === 0 ? <Vazio texto="Nenhum lançamento no período." /> : (
            <table className="tabela">
              <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="num">Receita</th><th className="num">Custo das peças</th><th className="num">Gasto</th></tr></thead>
              <tbody>{resumo.dados.extrato.map((l) => (
                <tr key={`${l.tipo}-${l.ref_id}`}>
                  <td data-label="Data">{formatarData(l.data)}</td>
                  <td data-label="Tipo"><Badge cor={TIPOS[l.tipo][1]}>{TIPOS[l.tipo][0]}</Badge></td>
                  <td data-label="Descrição">{l.descricao}</td>
                  <td data-label="Receita" className="num">{l.receita ? brl(l.receita) : '—'}</td>
                  <td data-label="Custo das peças" className="num">{l.custo ? brl(l.custo) : '—'}</td>
                  <td data-label="Gasto" className="num">{l.gasto ? brl(l.gasto) : '—'}</td>
                </tr>))}
              </tbody>
            </table>
          ))}
        </Estado>
      )}

      {aba === 'gastos' && (
        <>
          <div className="barra">
            <p className="muted grow">Gastos do período: <b>{brl(gastos.dados?.total || 0)}</b> (aluguel, energia, salários, ferramentas…). Compras de peças para estoque <b>não</b> entram aqui.</p>
            <button className="btn primario" onClick={() => setEditando('novo')}>+ Novo gasto</button>
          </div>
          <Estado dados={gastos.dados} erro={gastos.erro} onTentar={gastos.recarregar}>
            {gastos.dados && (gastos.dados.itens.length === 0 ? <Vazio texto="Nenhum gasto no período." /> : (
              <table className="tabela">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th><th>Ações</th></tr></thead>
                <tbody>{gastos.dados.itens.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Data">{formatarData(g.data)}</td>
                    <td data-label="Descrição">{g.descricao} {g.demo ? <SeloDemo /> : null}</td>
                    <td data-label="Categoria">{g.categoria}</td>
                    <td data-label="Valor" className="num">{brl(g.valor)}</td>
                    <td data-label="Ações" className="acoes-linha">
                      <button className="btn pequeno" onClick={() => setEditando(g)}>Editar</button>
                      <button className="btn pequeno perigo-suave" onClick={() => setExcluindo(g)}>Excluir</button>
                    </td>
                  </tr>))}
                </tbody>
              </table>
            ))}
          </Estado>
        </>
      )}

      {editando && <FormGasto gasto={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)}
        onSalvo={() => { setEditando(null); toast('Gasto salvo.'); atualizar(); }} />}
      {excluindo && (
        <Confirmar titulo="Excluir gasto" texto={`Excluir o gasto “${excluindo.descricao}” de ${brl(excluindo.valor)}?`} onNao={() => setExcluindo(null)}
          onSim={async () => { await api(`/gastos/${excluindo.id}`, { method: 'DELETE' }); setExcluindo(null); toast('Gasto excluído.'); atualizar(); }} />
      )}
    </>
  );
}

function Resumo({ r }) {
  const max = Math.max(1, ...r.serie.map((p) => Math.max(p.receita, p.custo + p.gastos)));
  return (
    <>
      <div className="grade-cartoes">
        <Cartao rotulo="Receita total" valor={brl(r.receita_total)} detalhe={`Vendas ${brl(r.receita_vendas)} · Serviços ${brl(r.receita_servicos)}`} />
        <Cartao rotulo="Custo das peças" valor={brl(r.custo_total)} detalhe="Peças vendidas e usadas em OS" />
        <Cartao rotulo="Lucro bruto" valor={brl(r.lucro_bruto)} tom={r.lucro_bruto < 0 ? 'negativo' : 'positivo'} detalhe="Receita − custo das peças" />
        <Cartao rotulo="Gastos" valor={brl(r.gastos_total)} detalhe="Despesas do período" />
        <Cartao rotulo="Lucro líquido" valor={brl(r.lucro_liquido)} tom={r.lucro_liquido < 0 ? 'negativo' : 'positivo'}
          detalhe={r.margem_liquida == null ? 'Sem receita no período' : `Margem de ${String(r.margem_liquida).replace('.', ',')}%`} />
      </div>

      <Ajuda titulo="Como esses números são calculados?">
        <p><b>Receita</b> = vendas de balcão (já com desconto) + ordens de serviço concluídas/entregues (mão de obra + peças), na data da venda ou da conclusão.</p>
        <p><b>Custo das peças</b> = custo de cada peça no momento em que foi vendida ou usada. <b>Lucro bruto</b> = receita − custo das peças.</p>
        <p><b>Lucro líquido</b> = lucro bruto − gastos do período. Comprar estoque não é gasto: só vira custo quando a peça sai.</p>
        <p>Detalhe: mão de obra ({brl(r.receita_mao_de_obra)}) e peças das OS ({brl(r.receita_pecas_os)}); {r.qtd_vendas} venda(s) e {r.qtd_os} OS no período.</p>
      </Ajuda>

      <section className="painel-caixa">
        <h3>Receita × custos e gastos</h3>
        {r.serie.length === 0 ? <Vazio texto="Sem movimento financeiro no período." /> : (
          <div className="grafico" role="img" aria-label="Gráfico de receita e despesas por período">
            {r.serie.map((p) => (
              <div key={p.chave} className="coluna" title={`${p.chave}: receita ${brl(p.receita)}, custos+gastos ${brl(p.custo + p.gastos)}`}>
                <div className="barras">
                  <div className="barra-receita" style={{ height: `${(p.receita / max) * 100}%` }} />
                  <div className="barra-custo" style={{ height: `${((p.custo + p.gastos) / max) * 100}%` }} />
                </div>
                <small>{p.chave.length === 10 ? p.chave.slice(8) + '/' + p.chave.slice(5, 7) : p.chave.slice(5) + '/' + p.chave.slice(2, 4)}</small>
              </div>
            ))}
          </div>
        )}
        <p className="legenda"><span className="q verde" /> Receita <span className="q vermelho" /> Custo das peças + gastos</p>
      </section>

      <section className="painel-caixa">
        <h3>Gastos por categoria</h3>
        {r.gastos_por_categoria.length === 0 ? <Vazio texto="Sem gastos no período." /> : (
          <ul className="lista-simples">{r.gastos_por_categoria.map((c) => <li key={c.categoria}><span>{c.categoria}</span><b>{brl(c.valor)}</b></li>)}</ul>
        )}
      </section>
    </>
  );
}

function FormGasto({ gasto, onFechar, onSalvo }) {
  const novo = !gasto;
  const [f, setF] = useState(novo ? { descricao: '', categoria: '', valor: '', data: hoje(), observacao: '' }
    : { descricao: gasto.descricao, categoria: gasto.categoria, valor: centavosParaCampo(gasto.valor), data: gasto.data, observacao: gasto.observacao });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = (e) => {
    e.preventDefault();
    enviar(async () => {
      const valor = reaisParaCentavos(f.valor);
      if (Number.isNaN(valor)) throw new Error('Informe o valor em reais, por exemplo 150,00.');
      await api(novo ? '/gastos' : `/gastos/${gasto.id}`, { method: novo ? 'POST' : 'PUT', body: { ...f, categoria: f.categoria || 'Outros', valor } });
      onSalvo();
    });
  };
  return (
    <Modal titulo={novo ? 'Novo gasto' : 'Editar gasto'} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <Alerta erro={erro} />
        <Campo rotulo="Descrição *"><input value={f.descricao} onChange={mudar('descricao')} required maxLength={150} autoFocus /></Campo>
        <div className="linha-campos">
          <Campo rotulo="Categoria"><input value={f.categoria} onChange={mudar('categoria')} list="cats-gasto" placeholder="Ex.: Aluguel" maxLength={60} />
            <datalist id="cats-gasto">{['Aluguel', 'Energia', 'Água', 'Internet', 'Salários', 'Ferramentas', 'Marketing', 'Impostos', 'Outros'].map((c) => <option key={c} value={c} />)}</datalist></Campo>
          <Campo rotulo="Valor (R$) *"><input inputMode="decimal" value={f.valor} onChange={mudar('valor')} required placeholder="0,00" /></Campo>
          <Campo rotulo="Data *"><input type="date" value={f.data} onChange={mudar('data')} required /></Campo>
        </div>
        <Campo rotulo="Observação"><input value={f.observacao} onChange={mudar('observacao')} maxLength={300} /></Campo>
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
