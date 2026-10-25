import { Router } from 'express';
import { z } from 'zod';
import { txt, textoLivre, idParam, like } from '../validators.js';
import { ErroNegocio } from '../services/util.js';
import { derivar } from '../services/os.js';

export function clientesRouter(db) {
  const r = Router();
  const schema = z.object({
    nome: txt(120),
    telefone: z.string().trim().max(25).default('').transform((v) => v.replace(/\D/g, ''))
      .refine((v) => v === '' || v.length === 10 || v.length === 11, 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).'),
    whatsapp: z.boolean().default(false),
    email: z.string().trim().max(120).default('').refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.'),
    observacoes: textoLivre(500),
  }).refine((d) => !d.whatsapp || d.telefone !== '', { path: ['whatsapp'], message: 'Informe o telefone para marcar WhatsApp.' });

  const buscar = (id) => db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);

  r.get('/', (req, res) => {
    const where = ['1=1'];
    const args = [];
    if (req.query.busca) {
      where.push("(nome LIKE ? ESCAPE '\\' OR telefone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
      args.push(like(req.query.busca), like(String(req.query.busca).replace(/\D/g, '') || req.query.busca), like(req.query.busca));
    }
    res.json(db.prepare(`SELECT * FROM clientes WHERE ${where.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...args));
  });

  r.get('/:id/historico', (req, res) => {
    const id = idParam(req);
    const cliente = buscar(id);
    if (!cliente) throw new ErroNegocio('Cliente não encontrado.', 404);
    const ordens = db.prepare(
      `SELECT o.*, COALESCE((SELECT SUM(quantidade * preco_unitario) FROM os_pecas WHERE os_id = o.id), 0) AS total_pecas
       FROM ordens_servico o WHERE cliente_id = ? ORDER BY o.data_entrada DESC, o.id DESC`,
    ).all(id).map(derivar);
    const vendas = db.prepare('SELECT * FROM vendas WHERE cliente_id = ? ORDER BY data DESC, id DESC').all(id);
    const total_gasto =
      ordens.filter((o) => ['concluida', 'entregue'].includes(o.status)).reduce((s, o) => s + o.total, 0) +
      vendas.reduce((s, v) => s + v.total, 0);
    res.json({ cliente, ordens, vendas, total_gasto });
  });

  r.get('/:id', (req, res) => {
    const c = buscar(idParam(req));
    if (!c) throw new ErroNegocio('Cliente não encontrado.', 404);
    res.json(c);
  });

  r.post('/', (req, res) => {
    const d = schema.parse(req.body);
    const id = Number(db.prepare('INSERT INTO clientes (nome, telefone, whatsapp, email, observacoes) VALUES (?,?,?,?,?)')
      .run(d.nome, d.telefone, d.whatsapp ? 1 : 0, d.email, d.observacoes).lastInsertRowid);
    res.status(201).json(buscar(id));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req);
    const d = schema.parse(req.body);
    const info = db.prepare('UPDATE clientes SET nome=?, telefone=?, whatsapp=?, email=?, observacoes=? WHERE id=?')
      .run(d.nome, d.telefone, d.whatsapp ? 1 : 0, d.email, d.observacoes, id);
    if (!info.changes) throw new ErroNegocio('Cliente não encontrado.', 404);
    res.json(buscar(id));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    if (!buscar(id)) throw new ErroNegocio('Cliente não encontrado.', 404);
    const { n } = db.prepare(
      'SELECT (SELECT COUNT(*) FROM ordens_servico WHERE cliente_id = @id) + (SELECT COUNT(*) FROM vendas WHERE cliente_id = @id) AS n',
    ).get({ id });
    if (n > 0) throw new ErroNegocio('Este cliente possui ordens de serviço ou vendas no histórico e não pode ser excluído.', 409);
    db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  return r;
}
