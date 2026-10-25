import { lerConfig } from './config.js';
import { abrirBanco } from './db.js';
import { criarApp } from './app.js';

const config = lerConfig();
const db = abrirBanco(config.dbPath);
const app = criarApp(db, config);

app.listen(config.porta, config.host, () => {
  console.log(`Cavalo Bike rodando em http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.porta}`);
  if (config.senhaPadrao) console.warn('ATENÇÃO: usando a senha padrão "cavalo123". Defina APP_SENHA no arquivo backend/.env.');
});

const encerrar = () => { db.close(); process.exit(0); };
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
