require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const authRoutes    = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const pedidosRoutes  = require('./routes/pedidos');
const miscRoutes     = require('./routes/misc');

const app = express();

// ─── Middlewares globais ─────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', versao: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Rotas ───────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/pedidos',  pedidosRoutes);
app.use('/api',          miscRoutes);

// ─── Tratamento de rotas não encontradas ─────────────────────
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// ─── Tratamento global de erros ──────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ─── Inicia o servidor ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Take Girls API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);

  try {
    await pool.query('SELECT 1');
    console.log('   ✅ PostgreSQL conectado\n');
  } catch (err) {
    console.error('   ❌ Erro ao conectar ao banco:', err.message);
  }
});

module.exports = app;
