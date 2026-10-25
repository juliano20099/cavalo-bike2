import { z } from 'zod';
import { ErroNegocio } from './services/util.js';

export const txt = (max, min = 1) =>
  z.string({ required_error: 'Campo obrigatório.', invalid_type_error: 'Texto inválido.' })
    .trim()
    .min(min, 'Campo obrigatório.')
    .max(max, `Use no máximo ${max} caracteres.`);

export const textoLivre = (max) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default('');

export const centavos = z
  .number({ required_error: 'Informe o valor.', invalid_type_error: 'Informe um valor numérico.' })
  .int('O valor deve ser inteiro, em centavos.')
  .min(0, 'O valor não pode ser negativo.')
  .max(1_000_000_000, 'Valor muito alto.');

export const idRef = z
  .number({ required_error: 'Campo obrigatório.', invalid_type_error: 'Seleção inválida.' })
  .int('Seleção inválida.')
  .positive('Seleção inválida.');

export const qtd = z
  .number({ required_error: 'Informe a quantidade.', invalid_type_error: 'Informe um número.' })
  .int('A quantidade deve ser um número inteiro.')
  .positive('A quantidade deve ser maior que zero.')
  .max(100000, 'Quantidade muito alta.');

export const dataISO = z
  .string({ required_error: 'Informe a data.', invalid_type_error: 'Data inválida.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Data inválida.');

export function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroNegocio('Identificador inválido.', 400);
  return id;
}

/** Prepara texto para LIKE seguro (escapa % e _). Use com: LIKE ? ESCAPE '\' */
export const like = (s) => `%${String(s).trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

const ehData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const periodo = (q, padraoDe, padraoAte) => [ehData(q.de) ? q.de : padraoDe, ehData(q.ate) ? q.ate : padraoAte];
