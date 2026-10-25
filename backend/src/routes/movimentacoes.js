import { Router } from 'express';
import { z } from 'zod';
import { idRef, qtd, centavos, dataISO, textoLivre } from '../validators.js';
import { moverEstoque } from '../services/estoque.js';
import { hoje } from '../services/util.js';

const MOTIVOS = { entrada: ['compra', 'ajuste', 'devolucao'], saida: ['perda', 'ajuste', 'uso_interno'] };

export function movimentacoesRouter(db) {
  const r = Router();
  const schema = z.object({
    produto_id: idRef,
    tipo: z.enum(['entrada', 'saida'], { errorMap: () => ({ message: 'Escolha entrada ou saída.' }) }),
    quantidade: qtd,
    custo_unitario: centavos.nullish(),
    motivo: z.string().trim().min(1, 'Escolha o motivo.'),
    observacao: textoLivre(300),
    data: dataISO.optional(),
  }).superRefine((d, ctx) => {
    if (!MOTIVOS[d.tipo].includes(d.motivo)) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Motivo não permitido para este tipo de movimentação.' });
    }
  });

  r.get('/', (req, res) => {
    const { produto_id, tipo, de, ate } = req.query;
    const limite = Math.min(Number(req.query.limite) || 200, 1000);
    const where = ['1=1'];
    const args = [];
    if (produto_id) { where.push('m.produto_id = ?'); args.push(Number(produto_id)); }
    if (tipo === 'entrada' || tipo === 'saida') { where.push('m.tipo = ?'); args.push(tipo); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(de || '')) { where.push('m.data >= ?'); args.push(de); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(ate || '')) { where.push('m.data <= ?'); args.push(ate); }
    res.json(db.prepare(
      `SELECT m.*, p.nome AS produto_nome FROM movimentacoes m JOIN produtos p ON p.id = m.produto_id
       WHERE ${where.join(' AND ')} ORDER BY m.data DESC, m.id DESC LIMIT ?`,
    ).all(...args, limite));
  });

  // Movimentações são um histórico: não são editadas nem excluídas. Para corrigir, registre um ajuste.
  r.post('/', (req, res) => {
    const d = schema.parse(req.body);
    const mov = db.transaction(() => moverEstoque(db, { ...d, data: d.data ?? hoje() }))();
    res.status(201).json(mov);
  });

  return r;
}
