# 🚲 Cavalo Bike — Gestão de estoque e oficina

Sistema web para a loja de bicicletas **Cavalo Bike**: estoque de produtos/peças, entradas e saídas, vendas de balcão, ordens de serviço (oficina), clientes com WhatsApp, financeiro (receita, gastos, lucro bruto e líquido) e painel com indicadores. Interface em português do Brasil, responsiva (celular, tablet e computador).

## Stack e arquitetura

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | React 18 + Vite (CSS próprio, sem bibliotecas de UI) | Poucas dependências, fácil de manter |
| Backend | Node.js + Express | API REST simples |
| Banco | SQLite (`better-sqlite3`) | Um único arquivo, sem servidor de banco, backup = copiar o arquivo |
| Validação | Zod (backend) + checagens nos formulários | Dados sempre validados no servidor |

```
Navegador (React) ──HTTP/JSON──▶ Express (/api/*) ──▶ SQLite (backend/data/cavalo-bike.db)
                                   │
                                   ├─ routes/     recebe e valida a requisição (Zod)
                                   └─ services/   regras de negócio (estoque, OS, vendas, financeiro)
```

```
cavalo-bike/
├─ package.json            scripts da raiz (dev, start, test, seed)
├─ backend/
│  ├─ .env.example         configurações (copie para .env)
│  ├─ src/
│  │  ├─ server.js · app.js · config.js · db.js (esquema) · auth.js · validators.js
│  │  ├─ routes/           produtos, movimentacoes, clientes, os, vendas, financeiro(+gastos), painel(+demo)
│  │  └─ services/         estoque.js (ÚNICO ponto que altera quantidades), os.js, vendas.js, financeiro.js, demo.js
│  └─ tests/api.test.js    testes de API (banco em memória)
└─ frontend/
   └─ src/ App.jsx · api.js · utils.js(+teste) · components/ui.jsx · pages/*.jsx · styles.css
```

### Decisões importantes
- **Dinheiro em centavos** (inteiros) no banco e na API; a tela converte de/para “12,50”. Evita erros de arredondamento.
- **Estoque consistente:** toda mudança de quantidade passa por `services/estoque.js`, dentro de transações, e gera um registro em `movimentacoes`. Estoque nunca fica negativo.
- **Histórico não se apaga:** movimentações são imutáveis (para corrigir, faça um ajuste). Produto com histórico é *desativado* em vez de apagado; cliente com OS/vendas não pode ser excluído.
- **Ordem de serviço:** peças saem do estoque ao salvar; editar movimenta só a diferença; cancelar ou excluir a OS devolve as peças. A receita só conta quando o status é *Concluída* ou *Entregue*.
- **Custo médio:** numa compra com custo informado, o custo unitário do produto passa a ser a média ponderada.

### Como o financeiro é calculado
- **Receita** = vendas de balcão (com desconto) + OS concluídas/entregues (mão de obra + peças), na data da venda/conclusão.
- **Custo das peças** = custo unitário no momento da venda/uso × quantidade.
- **Lucro bruto** = receita − custo das peças. **Lucro líquido** = lucro bruto − gastos do período.
- Comprar estoque **não** é gasto (é ativo); vira custo quando a peça sai. Gastos são despesas como aluguel e energia.

## Requisitos
- **Node.js 18 ou superior** (recomendado 22 LTS) — https://nodejs.org
- Internet apenas na instalação (para baixar as dependências).

## Instalação e execução

```bash
# 1) Na pasta do projeto: instala raiz, backend e frontend de uma vez
npm install

# 2) (opcional, recomendado) configurar senha e porta
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
#    edite backend/.env e troque APP_SENHA

# 3) Desenvolvimento (recarrega sozinho)
npm run dev
#    Abra http://localhost:5173
#    Sem .env a senha provisória é: cavalo123  (o servidor avisa no terminal)
```

### Uso diário (modo produção, uma única porta)
1. No `backend/.env` defina `NODE_ENV=production`, `APP_SENHA` e `JWT_SECRET` (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Rode `npm start` (compila o frontend e inicia o servidor) e abra **http://localhost:3001**.
3. Para acessar de celular/tablet na mesma rede Wi-Fi, use `HOST=0.0.0.0` no `.env` e abra `http://IP-DO-COMPUTADOR:3001`.

### Dados de demonstração
Ao abrir o sistema vazio, o **Painel** oferece “Carregar dados de demonstração”. Também pelo terminal:
```bash
npm run seed          # carrega a demonstração
npm run limpar-demo   # remove somente os registros de demonstração
```
Tudo que é demonstração tem o selo **DEMO** na tela (nomes “Cliente Demonstração A…”, telefones zerados, valores ilustrativos) e pode ser removido pelo botão do Painel. **Não use dados de demonstração junto com a operação real**: remova-os antes.

### Testes
```bash
npm test                      # backend + frontend
npm test --prefix backend     # API: login, validações, estoque, OS, vendas, financeiro, demo
npm test --prefix frontend    # conversão de moeda, datas, telefone
```

## Segurança básica incluída
- Login por senha única + token JWT (12 h) em `sessionStorage`; todas as rotas `/api` (exceto login) exigem token.
- Senha comparada em tempo constante; limite de tentativas no login e limite geral de requisições.
- `helmet` (cabeçalhos de segurança), corpo JSON limitado a 100 KB, validação de todos os campos no servidor (Zod).
- SQL somente com consultas parametrizadas; buscas com `LIKE` escapado.
- Mensagens de erro claras ao usuário, sem vazar detalhes internos (erros 500 ficam só no log do servidor).
- Em produção o servidor se recusa a iniciar sem `APP_SENHA` e `JWT_SECRET`.

**Limites conscientes:** é um acesso único (sem usuários/perfis) e usa HTTP simples na rede local. Se for expor na internet, coloque atrás de HTTPS (por exemplo, proxy reverso) e use senha forte.

## Backup
Tudo fica em `backend/data/cavalo-bike.db`. Com o sistema **parado**, copie esse arquivo (e `-wal`/`-shm` se existirem) para um pen drive ou nuvem com frequência.

## API (resumo)
`POST /api/login` · `GET/POST/PUT/DELETE /api/produtos` · `GET/POST /api/movimentacoes` · `GET/POST/PUT/DELETE /api/clientes` (+ `/:id/historico`) · `GET/POST/PUT/DELETE /api/os` (+ `PATCH /:id/status`) · `GET/POST/DELETE /api/vendas` · `GET/POST/PUT/DELETE /api/gastos` · `GET /api/financeiro/resumo?de=AAAA-MM-DD&ate=AAAA-MM-DD` · `GET /api/painel` · `POST/DELETE /api/demo`.

## Ideias para evoluir
Impressão/PDF da OS, exportação CSV do financeiro, múltiplos usuários com perfis, controle de fornecedores e contas a pagar/receber.
