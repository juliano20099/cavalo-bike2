import { lerConfig } from './config.js';
import { abrirBanco } from './db.js';
import { carregarDemo, limparDemo } from './services/demo.js';

const db = abrirBanco(lerConfig().dbPath);
try {
  if (process.argv[2] === '--limpar') console.log('Dados de demonstração removidos:', limparDemo(db));
  else { carregarDemo(db); console.log('Dados de demonstração carregados (todos marcados como DEMO).'); }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
