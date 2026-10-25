import { useState } from 'react';
import { api } from '../api.js';
import { brl, formatarData, STATUS_OS, STATUS_COR } from '../utils.js';
import { Badge, Cartao, Confirmar, Estado, SeloDemo, useDados, useEnvio, useToast, Alerta, Vazio } from '../components/ui.jsx';

export default function Painel({ navegar }) {
  const { dados: d, erro, recarregar } = useDados(() => api('/painel'), []);
  const [limpando, setLimpando] = useState(false);
  const toast = useToast();
  const envio = useEnvio();

  const carregarDemo = () => envio.enviar(async () => {
    await api('/demo', { method: 'POST' });
    toast('Dados de demonstração carregados.');
    recarregar();
  });

  return (
    <Estado dados={d} erro={erro} onTentar={recarregar}>
      {d && (
        <>
          {d.vazio && (
            <div className="faixa">
              <div>
                <strong>Bem-vindo! O sistema ainda está vazio.</strong>
                <p>Comece cadastrando seus produtos e clientes, ou carregue dados de <b>demonstração</b> (fictícios) para conhecer as telas. Você pode apagá-los depois com um clique.</p>
                <Alerta erro={envio.erro} />
              </div>
              <button className="btn" disabled={envio.ocupado} onClick={carregarDemo}>Carregar dados de demonstração</button>
            </div>
          )}
          {d.tem_demo && (
            <div className="faixa demo">
              <div><strong>Há dados de demonstração no sistema.</strong> Eles aparecem com o selo <SeloDemo /> e entram nos totais. Remova-os antes de usar o sistema de verdade.</div>
              <button className="btn" onClick={() => setLimpando(true)}>Remover dados de demonstração</button>
            </div>
          )}

          <h2 className="secao">Este mês ({formatarData(d.mes.de)} a {formatarData(d.mes.ate)})</h2>
          <div className="grade-cartoes">
            <Cartao rotulo="Receita" valor={brl(d.mes.receita_total)} detalhe={`${d.mes.qtd_vendas} venda(s) e ${d.mes.qtd_os} serviço(s)`} onClick={() => navegar('financeiro')} />
            <Cartao rotulo="Lucro bruto" valor={brl(d.mes.lucro_bruto)} detalhe="Receita menos custo das peças" onClick={() => navegar('financeiro')} />
            <Cartao rotulo="Gastos" valor={brl(d.mes.gastos_total)} detalhe="Aluguel, energia etc." onClick={() => navegar('financeiro')} />
            <Cartao rotulo="Lucro líquido" valor={brl(d.mes.lucro_liquido)} tom={d.mes.lucro_liquido < 0 ? 'negativo' : 'positivo'} detalhe="Lucro bruto menos gastos" onClick={() => navegar('financeiro')} />
          </div>

          <h2 className="secao">Estoque e oficina</h2>
          <div className="grade-cartoes">
            <Cartao rotulo="Valor do estoque (a custo)" valor={brl(d.estoque.valor_estoque)} detalhe={`${d.estoque.produtos} produto(s) ativos`} onClick={() => navegar('produtos')} />
            <Cartao rotulo="Estoque baixo" valor={d.estoque.qtd_baixo} tom={d.estoque.qtd_baixo > 0 ? 'alerta' : ''} detalhe="Produtos no mínimo ou abaixo" onClick={() => navegar('produtos')} />
            <Cartao rotulo="OS em aberto" valor={d.os.em_aberto} detalhe="Abertas, em andamento ou aguardando peça" onClick={() => navegar('os')} />
            <Cartao rotulo="OS atrasadas" valor={d.os.atrasadas} tom={d.os.atrasadas > 0 ? 'alerta' : ''} detalhe="Passaram da data prevista" onClick={() => navegar('os')} />
            <Cartao rotulo="Clientes" valor={d.clientes} onClick={() => navegar('clientes')} />
          </div>

          <div className="duas-colunas">
            <section className="painel-caixa">
              <h3>⚠️ Reposição necessária</h3>
              {d.baixo.length === 0 ? <Vazio texto="Nenhum produto com estoque baixo." /> : (
                <ul className="lista-simples">
                  {d.baixo.map((p) => (
                    <li key={p.id}>
                      <span>{p.nome}</span>
                      <span><Badge cor={p.quantidade === 0 ? 'vermelho' : 'laranja'}>{p.quantidade === 0 ? 'Zerado' : `${p.quantidade} un.`}</Badge> <small className="muted">mín. {p.estoque_minimo}</small></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="painel-caixa">
              <h3>🔧 Últimas ordens de serviço</h3>
              {d.recentes.length === 0 ? <Vazio texto="Nenhuma ordem de serviço ainda." /> : (
                <ul className="lista-simples">
                  {d.recentes.map((o) => (
                    <li key={o.id}>
                      <span>#{o.id} · {o.cliente_nome}<br /><small className="muted">{o.bicicleta}</small></span>
                      <span><Badge cor={STATUS_COR[o.status]}>{STATUS_OS[o.status]}</Badge><br /><small>{brl(o.total)}</small></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {limpando && (
            <Confirmar
              titulo="Remover dados de demonstração"
              texto="Todos os produtos, clientes, vendas, ordens de serviço e gastos marcados como DEMO serão apagados. Os seus dados reais não serão afetados. Deseja continuar?"
              rotuloSim="Remover"
              onNao={() => setLimpando(false)}
              onSim={async () => { await api('/demo', { method: 'DELETE' }); setLimpando(false); toast('Dados de demonstração removidos.'); recarregar(); }}
            />
          )}
        </>
      )}
    </Estado>
  );
}
