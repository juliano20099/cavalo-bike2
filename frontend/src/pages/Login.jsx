import { useState } from 'react';
import { api, setToken } from '../api.js';
import { Alerta, Campo, useEnvio } from '../components/ui.jsx';

export default function Login({ onEntrar }) {
  const [senha, setSenha] = useState('');
  const { erro, ocupado, enviar } = useEnvio();

  const entrar = (e) => {
    e.preventDefault();
    enviar(async () => {
      const { token } = await api('/login', { method: 'POST', body: { senha } });
      setToken(token);
      onEntrar();
    });
  };

  return (
    <div className="login">
      <form className="login-caixa" onSubmit={entrar}>
        <div className="login-logo">🚲</div>
        <h1>Cavalo Bike</h1>
        <p className="muted">Gestão de estoque e oficina</p>
        <Alerta erro={erro} />
        <Campo rotulo="Senha de acesso">
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus required autoComplete="current-password" />
        </Campo>
        <button className="btn primario grande" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
