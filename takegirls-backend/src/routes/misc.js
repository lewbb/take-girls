const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── CATEGORIAS ───────────────────────────────────────────────

// GET /api/categorias
router.get('/categorias', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM categorias ORDER BY ordem ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar categorias.' });
  }
});

// ── PROMOÇÕES / CUPONS ───────────────────────────────────────

// GET /api/promocoes — lista (admin)
router.get('/promocoes', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM promocoes ORDER BY criado_em DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar promoções.' });
  }
});

// POST /api/promocoes — criar cupom (admin)
router.post('/promocoes', auth, async (req, res) => {
  const { nome, codigo, tipo, valor, validade, usos_max } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO promocoes (nome, codigo, tipo, valor, validade, usos_max)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nome, codigo?.toUpperCase(), tipo, valor, validade || null, usos_max || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ erro: 'Código já existe.' });
    res.status(500).json({ erro: 'Erro ao criar promoção.' });
  }
});

// PATCH /api/promocoes/:id/toggle — ativa/desativa (admin)
router.patch('/promocoes/:id/toggle', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE promocoes SET ativa = NOT ativa WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar promoção.' });
  }
});

// DELETE /api/promocoes/:id — excluir (admin)
router.delete('/promocoes/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM promocoes WHERE id=$1', [req.params.id]);
    res.json({ mensagem: 'Promoção excluída.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir promoção.' });
  }
});

// POST /api/cupom/validar — frontend valida cupom antes de finalizar
router.post('/cupom/validar', async (req, res) => {
  const { codigo, subtotal } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM promocoes
       WHERE codigo=$1 AND ativa=true
         AND (validade IS NULL OR validade >= NOW())
         AND (usos_max IS NULL OR usos_atual < usos_max)`,
      [codigo?.toUpperCase()]
    );
    const promo = rows[0];
    if (!promo) return res.status(404).json({ valido: false, erro: 'Cupom inválido ou expirado.' });

    let desconto = 0;
    if (promo.tipo === 'percentual') desconto = subtotal * (promo.valor / 100);
    else if (promo.tipo === 'fixo') desconto = promo.valor;

    res.json({ valido: true, tipo: promo.tipo, valor: promo.valor, desconto });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao validar cupom.' });
  }
});

// ── DASHBOARD — métricas resumidas (admin) ──────────────────
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [prod, ped, rec, estq] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM produtos WHERE status='ativo'"),
      pool.query("SELECT COUNT(*) FROM pedidos WHERE criado_em >= NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COALESCE(SUM(total),0) AS total FROM pedidos WHERE status NOT IN ('cancelado') AND criado_em >= NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COUNT(*) FROM produtos WHERE estoque = 0"),
    ]);
    res.json({
      produtos_ativos: parseInt(prod.rows[0].count),
      pedidos_mes: parseInt(ped.rows[0].count),
      receita_mes: parseFloat(rec.rows[0].total),
      produtos_esgotados: parseInt(estq.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar dashboard.' });
  }
});

module.exports = router;
