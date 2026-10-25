import { moverEstoque } from './estoque.js';
import { ErroNegocio, hoje, unirItens } from './util.js';

export const STATUS = ['aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'entregue', 'cancelada'];
export const FINAIS = ['concluida', 'entregue'];

/** Acrescenta total e flag de atraso (campos calculados). */
export function derivar(os) {
  os.total = os.mao_de_obra + (os.total_pecas ?? 0);
  os.atrasada = Boolean(
    os.data_prevista && os.data_prevista < hoje() && !FINAIS.includes(os.status) && os.status !== 'cancelada',
  );
  return os;
}

export function obterOS(db, id) {
  const os = db.prepare(
    `SELECT o.*, c.nome AS cliente_nome, c.telefone, c.whatsapp
     FROM ordens_servico o JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ?`,
  ).get(id);
  if (!os) return null;
  os.pecas = db.prepare(
    `SELECT p.id, p.produto_id, pr.nome AS produto_nome, p.quantidade, p.preco_unitario, p.custo_unitario
     FROM os_pecas p JOIN produtos pr ON pr.id = p.produto_id WHERE p.os_id = ? ORDER BY p.id`,
  ).all(id);
  os.total_pecas = os.pecas.reduce((s, p) => s + p.quantidade * p.preco_unitario, 0);
  return derivar(os);
}

const efetivo = (status, mapa) => (status === 'cancelada' ? new Map() : mapa);

/**
 * Cria (id = null) ou atualiza uma OS. As peças saem do estoque ao salvar;
 * ao editar, só a DIFERENÇA é movimentada. OS cancelada devolve as peças.
 */
export function salvarOS(db, id, d, { demo = 0 } = {}) {
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(d.cliente_id)) {
      throw new ErroNegocio('Cliente não encontrado.', 404);
    }
    const linhas = unirItens(d.pecas ?? []);
    const antigas = new Map();
    const custosAntigos = new Map();
    let statusAntigo = null;

    if (id) {
      const atual = db.prepare('SELECT status FROM ordens_servico WHERE id = ?').get(id);
      if (!atual) throw new ErroNegocio('Ordem de serviço não encontrada.', 404);
      statusAntigo = atual.status;
      for (const l of db.prepare('SELECT produto_id, quantidade, custo_unitario FROM os_pecas WHERE os_id = ?').all(id)) {
        antigas.set(l.produto_id, l.quantidade);
        custosAntigos.set(l.produto_id, l.custo_unitario);
      }
    }

    const conclusao = FINAIS.includes(d.status) ? d.data_conclusao || hoje() : null;
    const campos = [d.cliente_id, d.bicicleta, d.defeito, d.servico_realizado ?? '', d.mao_de_obra ?? 0, d.status,
      d.data_entrada, d.data_prevista ?? null, conclusao, d.observacoes ?? ''];

    if (id) {
      db.prepare(
        `UPDATE ordens_servico SET cliente_id=?, bicicleta=?, defeito=?, servico_realizado=?, mao_de_obra=?, status=?,
         data_entrada=?, data_prevista=?, data_conclusao=?, observacoes=? WHERE id=?`,
      ).run(...campos, id);
    } else {
      id = Number(
        db.prepare(
          `INSERT INTO ordens_servico (cliente_id, bicicleta, defeito, servico_realizado, mao_de_obra, status,
           data_entrada, data_prevista, data_conclusao, observacoes, demo) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(...campos, demo).lastInsertRowid,
      );
    }

    db.prepare('DELETE FROM os_pecas WHERE os_id = ?').run(id);

    const antes = efetivo(statusAntigo, antigas);
    const depois = efetivo(d.status, new Map(linhas.map((l) => [l.produto_id, l.quantidade])));
    for (const pid of new Set([...antes.keys(), ...depois.keys()])) {
      const delta = (depois.get(pid) || 0) - (antes.get(pid) || 0);
      if (delta === 0) continue;
      moverEstoque(db, {
        produto_id: pid, tipo: delta > 0 ? 'saida' : 'entrada', quantidade: Math.abs(delta),
        motivo: delta > 0 ? 'uso_os' : 'estorno_os', data: hoje(), os_id: id,
        observacao: `OS #${id}`, demo,
      });
    }

    for (const l of linhas) {
      const custo = custosAntigos.get(l.produto_id)
        ?? db.prepare('SELECT custo_unitario FROM produtos WHERE id = ?').get(l.produto_id).custo_unitario;
      db.prepare(
        'INSERT INTO os_pecas (os_id, produto_id, quantidade, preco_unitario, custo_unitario) VALUES (?,?,?,?,?)',
      ).run(id, l.produto_id, l.quantidade, l.preco_unitario, custo);
    }
    return id;
  })();
}

export function excluirOS(db, id) {
  return db.transaction(() => {
    const os = db.prepare('SELECT status FROM ordens_servico WHERE id = ?').get(id);
    if (!os) throw new ErroNegocio('Ordem de serviço não encontrada.', 404);
    if (os.status !== 'cancelada') {
      for (const l of db.prepare('SELECT produto_id, quantidade FROM os_pecas WHERE os_id = ?').all(id)) {
        moverEstoque(db, {
          produto_id: l.produto_id, tipo: 'entrada', quantidade: l.quantidade, motivo: 'estorno_os',
          data: hoje(), observacao: `Exclusão da OS #${id}`,
        });
      }
    }
    db.prepare('DELETE FROM ordens_servico WHERE id = ?').run(id);
  })();
}
