const CHAVE = 'cb_token';
export const getToken = () => sessionStorage.getItem(CHAVE);
export const setToken = (t) => (t ? sessionStorage.setItem(CHAVE, t) : sessionStorage.removeItem(CHAVE));

export class ApiError extends Error {
  constructor(mensagem, status, detalhes = []) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export async function api(caminho, { method = 'GET', body, params } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== '' && v != null && v !== false) qs.set(k, v);
  const url = `/api${caminho}${qs.toString() ? `?${qs}` : ''}`;
  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique se o sistema está em execução.', 0);
  }
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) {
    if (resp.status === 401 && caminho !== '/login') {
      setToken(null);
      window.dispatchEvent(new Event('cb:logout'));
    }
    throw new ApiError(dados?.erro || `Erro ${resp.status}`, resp.status, dados?.detalhes);
  }
  return dados;
}
