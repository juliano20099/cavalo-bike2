import { Router } from 'express';
import { z } from 'zod';
import { txt, textoLivre, centavos, idRef, qtd, dataISO, idParam, like } from '../validators.js';
import { ErroNegocio, hoje } from '../services/util.js';
import { STATUS, derivar, obterOS, salvarOS, excluirOS } from '../services/os.js';

export function osRouter(db) {
  const r = Router();
  const schema = z.object({
    cliente_id: idRef,
    bicicleta: txt(120),
    defeito: txt(1000),
    servico_realizado: textoLivre(1000),
    mao_de_obra: centavos.default(0),
    status: z.enum(STATUS, { errorMap: () => ({ message: 'Status inválido.' }) }).default('aberta'),
    data_entrada: dataISO,
    data_prevista: dataISO.nullish(),
    data_conclusao: dataISO.nullish(),
    observacoes: textoLivre(1000),
    pecas: z.array(z.object({ produto_id: idRef, quantidade: qtd, preco_unitario: centavos })).max(50, 'Máximo de 50 peças.').default([]),
  }).refine((d) => !d.data_prevista || d.data_prevista >= d.data_entrada, {
    path: ['data_prevista'], message: 'A data prevista não pode ser anterior à data de entrada.',
  });

  r.get('/', (req, res) => {
    const { busca, status, de, ate } = req.query;
    const where = ['1=1'];
    const args = [];
    if (busca) {
      where.push("(c.nome LIKE ? ESCAPE '\\' OR o.bicicleta LIKE ? ESCAPE '\\' OR o.defeito LIKE ? ESCAPE '\\' OR CAST(o.id AS TEXT) = ?)");
      args.push(like(busca), like(busca), like(busca), String(busca).replace('#', '').trim());
    }
    if (STATUS.includes(status)) { where.push('o.status = ?'); args.push(status); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(de || '')) { where.push('o.data_entrada >= ?'); args.push(de); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(ate || '')) { where.push('o.data_entrada <= ?'); args.push(ate); }
    const lista = db.prepare(
      `SELECT o.*, c.nome AS cliente_nome, c.telefone, c.whatsapp,
              COALESCE((SELECT SUM(quantidade * preco_unitario) FROM os_pecas WHERE os_id = o.id), 0) AS total_pecas
       FROM ordens_servico o JOIN clientes c ON c.id = o.cliente_id
       WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 500`,
    ).all(...args).map(derivar);
    res.json(lista);
  });

  r.get('/:id', (req, res) => {
    const os = obterOS(db, idParam(req));
    if (!os) throw new ErroNegocio('Ordem de serviço não encontrada.', 404);
    res.json(os);
  });

  r.post('/', (req, res) => {
    const id = salvarOS(db, null, schema.parse(req.body));
    res.status(201).json(obterOS(db, id));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req);
    salvarOS(db, id, schema.parse(req.body));
    res.json(obterOS(db, id));
  });

  // Troca rápida de status pela lista.
  r.patch('/:id/status', (req, res) => {
    const id = idParam(req);
    const { status } = z.object({ status: z.enum(STATUS, { errorMap: () => ({ message: 'Status inválido.' }) }) }).parse(req.body);
    const atual = obterOS(db, id);
    if (!atual) throw new ErroNegocio('Ordem de serviço não encontrada.', 404);
    salvarOS(db, id, {
      ...atual, status, data_conclusao: ['concluida', 'entregue'].includes(status) ? atual.data_conclusao || hoje() : null,
      pecas: atual.pecas.map((p) => ({ produto_id: p.produto_id, quantidade: p.quantidade, preco_unitario: p.preco_unitario })),
    });
    res.json(obterOS(db, id));
  });

  r.delete('/:id', (req, res) => {
    excluirOS(db, idParam(req));
    res.json({ ok: true });
  });

  return r;
}
