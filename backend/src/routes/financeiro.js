import { Router } from 'express';
import { z } from 'zod';
import { txt, textoLivre, centavos, dataISO, idParam, like, periodo } from '../validators.js';
import { ErroNegocio, hoje } from '../services/util.js';
import { calcularResumo } from '../services/financeiro.js';

export function financeiroRouter(db) {
  const r = Router();
  r.get('/resumo', (req, res) => {
    const [de, ate] = periodo(req.query, `${hoje().slice(0, 8)}01`, hoje());
    if (de > ate) throw new ErroNegocio('A data inicial não pode ser depois da data final.');
    res.json(calcularResumo(db, de, ate));
  });
  return r;
}

export function gastosRouter(db) {
  const r = Router();
  const schema = z.object({
    descricao: txt(150),
    categoria: txt(60).default('Outros'),
    valor: centavos.refine((v) => v > 0, 'O valor deve ser maior que zero.'),
    data: dataISO,
    observacao: textoLivre(300),
  });
  const buscar = (id) => db.prepare('SELECT * FROM gastos WHERE id = ?').get(id);

  r.get('/', (req, res) => {
    const [de, ate] = periodo(req.query, '0000-01-01', '9999-12-31');
    const where = ['data BETWEEN ? AND ?'];
    const args = [de, ate];
    if (req.query.busca) {
      where.push("(descricao LIKE ? ESCAPE '\\' OR categoria LIKE ? ESCAPE '\\')");
      args.push(like(req.query.busca), like(req.query.busca));
    }
    const itens = db.prepare(`SELECT * FROM gastos WHERE ${where.join(' AND ')} ORDER BY data DESC, id DESC LIMIT 500`).all(...args);
    res.json({ itens, total: itens.reduce((s, g) => s + g.valor, 0) });
  });

  r.post('/', (req, res) => {
    const d = schema.parse(req.body);
    const id = Number(db.prepare('INSERT INTO gastos (descricao, categoria, valor, data, observacao) VALUES (?,?,?,?,?)')
      .run(d.descricao, d.categoria, d.valor, d.data, d.observacao).lastInsertRowid);
    res.status(201).json(buscar(id));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req);
    const d = schema.parse(req.body);
    const info = db.prepare('UPDATE gastos SET descricao=?, categoria=?, valor=?, data=?, observacao=? WHERE id=?')
      .run(d.descricao, d.categoria, d.valor, d.data, d.observacao, id);
    if (!info.changes) throw new ErroNegocio('Gasto não encontrado.', 404);
    res.json(buscar(id));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM gastos WHERE id = ?').run(idParam(req));
    if (!info.changes) throw new ErroNegocio('Gasto não encontrado.', 404);
    res.json({ ok: true });
  });

  return r;
}
