export class ErroNegocio extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

/** Data de hoje (AAAA-MM-DD) no fuso da loja. */
export function hoje(fuso = process.env.FUSO || 'America/Sao_Paulo') {
  return new Date().toLocaleDateString('sv-SE', { timeZone: fuso });
}

export function addDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Junta linhas repetidas do mesmo produto somando as quantidades. */
export function unirItens(lista) {
  const mapa = new Map();
  for (const item of lista) {
    const existente = mapa.get(item.produto_id);
    if (existente) existente.quantidade += item.quantidade;
    else mapa.set(item.produto_id, { ...item });
  }
  return [...mapa.values()];
}
