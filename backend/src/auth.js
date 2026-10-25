import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function login(config) {
  return (req, res) => {
    const senha = req.body?.senha ?? '';
    if (!crypto.timingSafeEqual(hash(senha), hash(config.senha))) {
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }
    const token = jwt.sign({ sub: 'loja' }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '12h' });
    res.json({ token });
  };
}

export function autenticar(config) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    try {
      jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      next();
    } catch {
      res.status(401).json({ erro: 'Sessão expirada ou acesso não autorizado. Entre novamente.' });
    }
  };
}
