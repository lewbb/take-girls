# Take Girls — Backend API

API REST em Node.js + Express + PostgreSQL para a loja Take Girls.

---

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express
- **Banco de dados:** PostgreSQL
- **Autenticação:** JWT (JSON Web Token)
- **Hospedagem:** Render.com

---

## Passo a passo — do zero ao ar

### 1. Criar o banco no Render

1. Acesse [render.com](https://render.com) e crie uma conta
2. Clique em **New → PostgreSQL**
3. Preencha:
   - Name: `takegirls-db`
   - Database: `takegirls`
   - User: `takegirls`
   - Region: `Ohio (US East)` ou o mais próximo
4. Clique em **Create Database**
5. Copie a **External Database URL** (você vai precisar dela)

---

### 2. Criar o schema no banco

1. Abra o **PSQL Command** no painel do Render (ou use um cliente como TablePlus/DBeaver)
2. Cole e execute o conteúdo do arquivo `sql/schema.sql`
3. Pronto — as tabelas e dados de exemplo já estarão criados

---

### 3. Deploy do backend no Render

1. Suba este projeto para um repositório GitHub
2. No Render, clique em **New → Web Service**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** `takegirls-api`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Em **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | (cole a URL do passo 1) |
| `JWT_SECRET` | (gere uma string aleatória, ex: use [randomkeygen.com](https://randomkeygen.com)) |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | `seuemail@takegirls.com` |
| `ADMIN_PASSWORD` | `suasenhaforte` |
| `FRONTEND_URL` | `https://seu-site.vercel.app` |

6. Clique em **Create Web Service**

---

### 4. Criar o primeiro admin

Após o deploy, acesse uma vez via navegador ou Insomnia:

```
POST https://takegirls-api.onrender.com/api/auth/setup
```

Isso cria o admin com o email/senha que você definiu no `.env`. Depois disso, esse endpoint é bloqueado automaticamente.

---

### 5. Fazer login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "seuemail@takegirls.com",
  "senha": "suasenhaforte"
}
```

Resposta:
```json
{
  "token": "eyJhbGci...",
  "admin": { "id": 1, "email": "...", "nome": "Admin Take Girls" }
}
```

Use o `token` no header de todas as rotas admin:
```
Authorization: Bearer eyJhbGci...
```

---

## Endpoints da API

### Públicos (site)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status da API |
| GET | `/api/produtos` | Lista produtos ativos |
| GET | `/api/produtos/:id` | Detalhe do produto |
| GET | `/api/categorias` | Lista categorias |
| POST | `/api/cupom/validar` | Valida cupom de desconto |
| POST | `/api/pedidos` | Cria um novo pedido (checkout) |

### Protegidos (admin — requer token JWT)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos/admin` | Lista TODOS os produtos |
| POST | `/api/produtos` | Adiciona produto |
| PUT | `/api/produtos/:id` | Edita produto |
| PATCH | `/api/produtos/:id/promo` | Atualiza promoção |
| PATCH | `/api/produtos/:id/estoque` | Atualiza estoque |
| DELETE | `/api/produtos/:id` | Exclui produto |
| GET | `/api/pedidos` | Lista pedidos |
| GET | `/api/pedidos/:codigo` | Detalhe do pedido |
| PATCH | `/api/pedidos/:codigo/status` | Atualiza status |
| GET | `/api/promocoes` | Lista cupons |
| POST | `/api/promocoes` | Cria cupom |
| PATCH | `/api/promocoes/:id/toggle` | Ativa/desativa cupom |
| DELETE | `/api/promocoes/:id` | Exclui cupom |
| GET | `/api/dashboard` | Métricas do painel |

---

## Desenvolvimento local

```bash
# 1. Clone e instale
npm install

# 2. Configure o .env
cp .env.example .env
# Edite o .env com suas variáveis

# 3. Execute o schema no seu PostgreSQL local
psql -U postgres -d takegirls -f sql/schema.sql

# 4. Rode em modo dev (com hot reload)
npm run dev
```

---

## Conectar o site ao backend

No arquivo `takegirls.html`, troque a constante da API:

```js
const API_URL = 'https://takegirls-api.onrender.com';

// Buscar produtos
const produtos = await fetch(`${API_URL}/api/produtos`).then(r => r.json());

// Admin — com token
const res = await fetch(`${API_URL}/api/produtos`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(novoProduto)
});
```
