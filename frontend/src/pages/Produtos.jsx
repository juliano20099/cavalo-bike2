import { useState } from 'react';
import { api } from '../api.js';
import { brl, reaisParaCentavos, centavosParaCampo } from '../utils.js';
import { Alerta, Badge, Campo, Cartao, Confirmar, Estado, Modal, SeloDemo, Vazio, useDados, useEnvio, useToast, Ajuda } from '../components/ui.jsx';

const VAZIO = { nome: '', sku: '', categoria: '', quantidade: '0', estoque_minimo: '0', custo: '', preco: '' };

export default function Produtos({ navegar }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [baixo, setBaixo] = useState(false);
  const [editando, setEditando] = useState(null); // 'novo' | produto
  const [excluindo, setExcluindo] = useState(null);
  const toast = useToast();
  const lista = useDados(() => api('/produtos', { params: { busca, categoria, baixo: baixo ? 1 : '' } }), [busca, categoria, baixo]);
  const cats = useDados(() => api('/produtos/categorias'), []);

  const atualizar = () => { lista.recarregar(); cats.recarregar(); };

  return (
    <>
      <Ajuda titulo="Como funciona o estoque?">
        <p>Cada produto tem <b>quantidade</b>, <b>custo unitário</b> (quanto você pagou) e <b>preço de venda</b>. O <b>valor do estoque</b> é quantidade × custo. Quando a quantidade fica igual ou abaixo do <b>estoque mínimo</b>, o produto aparece com alerta.</p>
        <p>Para mudar a quantidade, use <b>Entradas e saídas</b> (compras, perdas, ajustes). Vendas e ordens de serviço dão baixa automaticamente.</p>
      </Ajuda>

      {lista.dados && (
        <div className="grade-cartoes">
          <Cartao rotulo="Produtos ativos" valor={lista.dados.resumo.total_produtos} />
          <Cartao rotulo="Valor do estoque (custo)" valor={brl(lista.dados.resumo.valor_total_estoque)} />
          <Cartao rotulo="Valor potencial de venda" valor={brl(lista.dados.resumo.valor_potencial_venda)} />
          <Cartao rotulo="Estoque baixo" valor={lista.dados.resumo.qtd_baixo} tom={lista.dados.resumo.qtd_baixo > 0 ? 'alerta' : ''} />
        </div>
      )}

      <div className="barra">
        <input type="search" placeholder="Buscar por nome ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {(cats.dados || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={baixo} onChange={(e) => setBaixo(e.target.checked)} /> Só estoque baixo</label>
        <button className="btn primario" onClick={() => setEditando('novo')}>+ Novo produto</button>
      </div>

      <Estado dados={lista.dados} erro={lista.erro} onTentar={lista.recarregar}>
        {lista.dados && (lista.dados.itens.length === 0 ? <Vazio texto="Nenhum produto encontrado. Cadastre o primeiro em “Novo produto”." /> : (
          <table className="tabela">
            <thead><tr><th>Produto</th><th>Categoria</th><th className="num">Qtd.</th><th className="num">Mín.</th><th className="num">Custo</th><th className="num">Preço</th><th className="num">Valor em estoque</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.dados.itens.map((p) => (
                <tr key={p.id} className={p.baixo ? 'linha-alerta' : ''}>
                  <td data-label="Produto"><b>{p.nome}</b> {p.demo ? <SeloDemo /> : null}<br /><small className="muted">{p.sku || 'sem código'}</small></td>
                  <td data-label="Categoria">{p.categoria}</td>
                  <td data-label="Qtd." className="num">{p.quantidade} {p.baixo ? <Badge cor={p.quantidade === 0 ? 'vermelho' : 'laranja'}>{p.quantidade === 0 ? 'Zerado' : 'Baixo'}</Badge> : null}</td>
                  <td data-label="Mín." className="num">{p.estoque_minimo}</td>
                  <td data-label="Custo" className="num">{brl(p.custo_unitario)}</td>
                  <td data-label="Preço" className="num">{brl(p.preco_venda)}</td>
                  <td data-label="Valor em estoque" className="num">{brl(p.valor_estoque)}</td>
                  <td data-label="Ações" className="acoes-linha">
                    <button className="btn pequeno" onClick={() => navegar('movimentacoes', { produto_id: p.id })}>Movimentar</button>
                    <button className="btn pequeno" onClick={() => setEditando(p)}>Editar</button>
                    <button className="btn pequeno perigo-suave" onClick={() => setExcluindo(p)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </Estado>

      {editando && <FormProduto produto={editando === 'novo' ? null : editando} categorias={cats.dados || []}
        onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); toast('Produto salvo.'); atualizar(); }} />}

      {excluindo && (
        <Confirmar titulo="Excluir produto"
          texto={`Excluir “${excluindo.nome}”? Se ele já tiver movimentações, vendas ou ordens de serviço, será apenas desativado (some das listas, mas o histórico financeiro é preservado).`}
          onNao={() => setExcluindo(null)}
          onSim={async () => { const r = await api(`/produtos/${excluindo.id}`, { method: 'DELETE' }); setExcluindo(null); toast(r.inativado ? 'Produto desativado (tinha histórico).' : 'Produto excluído.'); atualizar(); }} />
      )}
    </>
  );
}

function FormProduto({ produto, categorias, onFechar, onSalvo }) {
  const novo = !produto;
  const [f, setF] = useState(novo ? VAZIO : {
    nome: produto.nome, sku: produto.sku || '', categoria: produto.categoria, quantidade: String(produto.quantidade),
    estoque_minimo: String(produto.estoque_minimo), custo: centavosParaCampo(produto.custo_unitario), preco: centavosParaCampo(produto.preco_venda),
  });
  const { erro, ocupado, enviar } = useEnvio();
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salvar = (e) => {
    e.preventDefault();
    enviar(async () => {
      const custo = reaisParaCentavos(f.custo);
      const preco = reaisParaCentavos(f.preco);
      if (Number.isNaN(custo)) throw new Error('Informe o custo unitário em reais, por exemplo 12,50.');
      if (Number.isNaN(preco)) throw new Error('Informe o preço de venda em reais, por exemplo 25,00.');
      const corpo = { nome: f.nome, sku: f.sku || null, categoria: f.categoria || 'Outros', estoque_minimo: Number(f.estoque_minimo), custo_unitario: custo, preco_venda: preco };
      if (novo) corpo.quantidade = Number(f.quantidade);
      await api(novo ? '/produtos' : `/produtos/${produto.id}`, { method: novo ? 'POST' : 'PUT', body: corpo });
      onSalvo();
    });
  };

  return (
    <Modal titulo={novo ? 'Novo produto / peça' : 'Editar produto'} onFechar={onFechar}>
      <form onSubmit={salvar} className="form">
        <Alerta erro={erro} />
        <Campo rotulo="Nome *"><input value={f.nome} onChange={mudar('nome')} required maxLength={120} autoFocus /></Campo>
        <div className="linha-campos">
          <Campo rotulo="Código (SKU)" dica="Opcional, mas não pode repetir."><input value={f.sku} onChange={mudar('sku')} maxLength={40} /></Campo>
          <Campo rotulo="Categoria"><input value={f.categoria} onChange={mudar('categoria')} list="cats" placeholder="Ex.: Freios" maxLength={60} /><datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></Campo>
        </div>
        <div className="linha-campos">
          {novo
            ? <Campo rotulo="Quantidade inicial"><input type="number" min="0" step="1" value={f.quantidade} onChange={mudar('quantidade')} /></Campo>
            : <Campo rotulo="Quantidade atual" dica="Altere em “Entradas e saídas”."><input value={f.quantidade} disabled /></Campo>}
          <Campo rotulo="Estoque mínimo" dica="Abaixo disso, o alerta aparece."><input type="number" min="0" step="1" value={f.estoque_minimo} onChange={mudar('estoque_minimo')} /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Custo unitário (R$) *" dica="Quanto você paga."><input inputMode="decimal" value={f.custo} onChange={mudar('custo')} placeholder="0,00" required /></Campo>
          <Campo rotulo="Preço de venda (R$) *"><input inputMode="decimal" value={f.preco} onChange={mudar('preco')} placeholder="0,00" required /></Campo>
        </div>
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
