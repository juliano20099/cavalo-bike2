import 'dotenv/config';
import crypto from 'node:crypto';

export function lerConfig(env = process.env) {
  const producao = env.NODE_ENV === 'production';
  if (producao && (!env.APP_SENHA || !env.JWT_SECRET)) {
    throw new Error('Em produção, defina APP_SENHA e JWT_SECRET no arquivo backend/.env');
  }
  return {
    producao,
    porta: Number(env.PORT || 3001),
    host: env.HOST || '127.0.0.1',
    senha: env.APP_SENHA || 'cavalo123',
    senhaPadrao: !env.APP_SENHA,
    jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
    corsOrigin: env.CORS_ORIGIN || null,
    dbPath: env.DB_PATH || './data/cavalo-bike.db',
  };
}
