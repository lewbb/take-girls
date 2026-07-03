require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const authRoutes = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const pedidosRoutes = require('./routes/pedidos');
const miscRoutes = require('./routes/misc');

const app = express();

// ─── CORS ─────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    /\.vercel\.app$/
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROOT ROUTE ───────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "API Take Girls rodando 🚀",
    health: "/health",
    endpoints: {
      auth: "/api/auth",
      produtos: "/api/produtos",
      pedidos: "/api/pedidos",
      misc: "/api"
    }
  });
});

// ─── HEALTH CHECK ─────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    versao: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── ROUTES ───────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api', miscRoutes);

// ─── 404 ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada.',
    url: req.originalUrl
  });
});

// ─── ERROR HANDLER ─────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    erro: 'Erro interno do servidor.'
  });
});

// ─── START SERVER ──────────────────────
const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`🚀 API rodando na porta ${PORT}`);

  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL conectado');
  } catch (err) {
    console.error('❌ Erro no banco:', err.message);
  }
});

module.exports = app;