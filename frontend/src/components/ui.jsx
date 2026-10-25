import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- Avisos (toasts) ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);
  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItens((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setItens((l) => l.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="toasts" aria-live="polite">
        {itens.map((i) => <div key={i.id} className={`toast ${i.tipo}`}>{i.texto}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Carregamento de dados ---------- */
export function useDados(buscar, deps = []) {
  const [estado, setEstado] = useState({ dados: null, erro: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let ativo = true;
    buscar()
      .then((dados) => ativo && setEstado({ dados, erro: null }))
      .catch((e) => ativo && setEstado((s) => ({ ...s, erro: e.message })));
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...estado, recarregar: () => setN((x) => x + 1) };
}

export function Estado({ dados, erro, onTentar, children }) {
  if (erro && !dados) {
    return <div className="alerta">{erro} <button className="btn pequeno" onClick={onTentar}>Tentar novamente</button></div>;
  }
  if (!dados) return <p className="muted">Carregando…</p>;
  return children;
}

/* ---------- Envio de formulários ---------- */
export function useEnvio() {
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(fn) {
    setErro(null);
    setOcupado(true);
    try { return await fn(); } catch (e) { setErro(e); return undefined; } finally { setOcupado(false); }
  }
  return { erro, ocupado, enviar };
}

export function Alerta({ erro }) {
  if (!erro) return null;
  return (
    <div className="alerta" role="alert">
      {erro.message}
      {erro.detalhes?.length > 0 && <ul>{erro.detalhes.map((d, i) => <li key={i}>{d.campo}: {d.mensagem}</li>)}</ul>}
    </div>
  );
}

/* ---------- Componentes visuais ---------- */
export function Modal({ titulo, onFechar, largo, children }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onFechar]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`modal${largo ? ' largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="icone" onClick={onFechar} aria-label="Fechar">✕</button>
        </header>
        <div className="corpo">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ rotulo, dica, children }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small>{dica}</small>}
    </label>
  );
}

export function Confirmar({ titulo = 'Confirmar', texto, rotuloSim = 'Excluir', onSim, onNao }) {
  const { erro, ocupado, enviar } = useEnvio();
  return (
    <Modal titulo={titulo} onFechar={onNao}>
      <p>{texto}</p>
      <Alerta erro={erro} />
      <div className="acoes">
        <button className="btn" onClick={onNao} disabled={ocupado}>Cancelar</button>
        <button className="btn perigo" disabled={ocupado} onClick={() => enviar(onSim)}>{ocupado ? 'Aguarde…' : rotuloSim}</button>
      </div>
    </Modal>
  );
}

export const Badge = ({ cor = 'cinza', children }) => <span className={`badge ${cor}`}>{children}</span>;
export const SeloDemo = () => <span className="badge demo" title="Registro de demonstração">DEMO</span>;
export const Vazio = ({ texto }) => <div className="vazio">{texto}</div>;

export function Cartao({ rotulo, valor, detalhe, tom, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`cartao ${tom || ''}`} onClick={onClick}>
      <span className="rotulo">{rotulo}</span>
      <strong className="valor">{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </Tag>
  );
}

export function Ajuda({ titulo, children }) {
  return <details className="ajuda"><summary>{titulo}</summary><div>{children}</div></details>;
}
