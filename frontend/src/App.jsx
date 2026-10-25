import { useEffect, useState } from 'react';
import { getToken, setToken } from './api.js';
import { ToastProvider } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Painel from './pages/Painel.jsx';
import Produtos from './pages/Produtos.jsx';
import Movimentacoes from './pages/Movimentacoes.jsx';
import Vendas from './pages/Vendas.jsx';
import OrdensServico from './pages/OrdensServico.jsx';
import Clientes from './pages/Clientes.jsx';
import Financeiro from './pages/Financeiro.jsx';

const PAGINAS = [
  { id: 'painel', nome: 'Painel', icone: '📊', comp: Painel },
  { id: 'produtos', nome: 'Estoque', icone: '📦', comp: Produtos },
  { id: 'movimentacoes', nome: 'Entradas e saídas', icone: '🔁', comp: Movimentacoes },
  { id: 'vendas', nome: 'Vendas', icone: '🛒', comp: Vendas },
  { id: 'os', nome: 'Oficina (OS)', icone: '🔧', comp: OrdensServico },
  { id: 'clientes', nome: 'Clientes', icone: '👤', comp: Clientes },
  { id: 'financeiro', nome: 'Financeiro', icone: '💰', comp: Financeiro },
];

export default function App() {
  const [logado, setLogado] = useState(Boolean(getToken()));
  const [pag, setPag] = useState({ id: 'painel', params: {} });
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const sair = () => setLogado(false);
    window.addEventListener('cb:logout', sair);
    return () => window.removeEventListener('cb:logout', sair);
  }, []);

  const navegar = (id, params = {}) => { setPag({ id, params }); setMenu(false); window.scrollTo(0, 0); };

  if (!logado) return <ToastProvider><Login onEntrar={() => setLogado(true)} /></ToastProvider>;

  const atual = PAGINAS.find((p) => p.id === pag.id);
  const Pagina = atual.comp;

  return (
    <ToastProvider>
      <div className="layout">
        <header className="topo">
          <button className="icone" onClick={() => setMenu(!menu)} aria-label="Abrir menu">☰</button>
          <strong>🚲 Cavalo Bike</strong>
        </header>
        <nav className={`menu${menu ? ' aberto' : ''}`} aria-label="Menu principal">
          <div className="marca">🚲 <span>Cavalo Bike</span></div>
          {PAGINAS.map((p) => (
            <button key={p.id} className={p.id === pag.id ? 'ativo' : ''} onClick={() => navegar(p.id)}>
              <span aria-hidden="true">{p.icone}</span> {p.nome}
            </button>
          ))}
          <button className="sair" onClick={() => { setToken(null); setLogado(false); }}>⎋ Sair</button>
        </nav>
        {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
        <main className="conteudo">
          <h1>{atual.icone} {atual.nome}</h1>
          <Pagina key={pag.id + JSON.stringify(pag.params)} params={pag.params} navegar={navegar} />
        </main>
      </div>
    </ToastProvider>
  );
}
