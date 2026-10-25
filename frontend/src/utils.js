// Dinheiro trafega em CENTAVOS (inteiros). Aqui convertemos de/para o formato brasileiro.
export const brl = (centavos) =>
  ((centavos ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "1.234,56" -> 123456 | "12,5" -> 1250 | "12.50" -> 1250 | inválido -> NaN */
export function reaisParaCentavos(texto) {
  if (typeof texto === 'number') return Math.round(texto * 100);
  let s = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

export const centavosParaCampo = (c) => (c / 100).toFixed(2).replace('.', ',');

/** Data de hoje no fuso do navegador (AAAA-MM-DD). */
export const hoje = () => new Date().toLocaleDateString('sv-SE');
export const addDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
};
export const inicioDoMes = () => `${hoje().slice(0, 8)}01`;
export const inicioDoAno = () => `${hoje().slice(0, 4)}-01-01`;

export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarTelefone(t) {
  const d = String(t ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '—';
}

export const linkWhatsApp = (t) => `https://wa.me/55${String(t ?? '').replace(/\D/g, '')}`;

export const STATUS_OS = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  concluida: 'Concluída',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};
export const STATUS_COR = {
  aberta: 'azul', em_andamento: 'amarelo', aguardando_peca: 'laranja',
  concluida: 'verde', entregue: 'cinza', cancelada: 'vermelho',
};
export const FORMAS_PAGAMENTO = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', outro: 'Outro' };
export const MOTIVOS = {
  compra: 'Compra de fornecedor', ajuste: 'Ajuste de inventário', devolucao: 'Devolução',
  perda: 'Perda / avaria', uso_interno: 'Uso interno da loja',
  venda: 'Venda', uso_os: 'Usado em ordem de serviço', estorno_venda: 'Cancelamento de venda',
  estorno_os: 'Devolução de ordem de serviço', estoque_inicial: 'Estoque inicial',
};
export const MOTIVOS_MANUAIS = {
  entrada: ['compra', 'ajuste', 'devolucao'],
  saida: ['perda', 'ajuste', 'uso_interno'],
};
