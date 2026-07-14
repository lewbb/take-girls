const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const validarProduto = [
  body('nome').notEmpty().withMessage('Nome é obrigatório.'),
  body('preco').isFloat({ min: 0 }).withMessage('Preço inválido.'),
  body('estoque').isInt({ min: 0 }).withMessage('Estoque inválido.'),
  body('status').isIn(['ativo','pausado','esgotado']).withMessage('Status inválido.'),
];

// ── GET /api/produtos — lista pública (para o site) ──────────
router.get('/', async (req, res) => {
  try {
    const { categoria, status, destaque, busca } = req.query;
    let query = `
      SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE 1=1
    `;
    const params = [];

    if (categoria) {
      params.push(categoria);
      query += ` AND c.slug = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    } else {
      query += ` AND p.status = 'ativo'`; // padrão: só ativos no site
    }
    if (destaque === 'true') {
      query += ` AND p.destaque = TRUE`;
    }
    if (busca) {
      params.push(`%${busca}%`);
      query += ` AND p.nome ILIKE $${params.length}`;
    }

    query += ` ORDER BY p.criado_em DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
  console.error("ERRO PRODUTOS:", err);
  res.status(500).json({
    erro: "Erro ao buscar produtos.",
    detalhe: err.message
  });
}
});

// ── GET /api/produtos/admin — lista completa (admin) ─────────
router.get('/admin', auth, async (req,res)=>{
  try {

    const { rows } = await pool.query(
      'SELECT * FROM produtos WHERE status = $1',
      ['ativo']
    );

    res.json(rows);

  } catch(error){

    console.error(error);

    res.status(500).json({
      erro:"Erro ao buscar produtos"
    });

  }
});

// ── GET /api/produtos/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produto.' });
  }
});

// ── POST /api/produtos — criar (admin) ───────────────────────
router.post('/', auth, validarProduto, async (req, res) => {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
  console.log("ERROS DE VALIDAÇÃO:", erros.array());
  return res.status(400).json({ erros: erros.array() });
}

const { nome, descricao, categoria_id, preco, preco_promo,
        estoque, tamanhos, status, destaque, badge, imagem_url } = req.body;

try {
  const { rows } = await pool.query(
    `INSERT INTO produtos
      (nome, descricao, categoria_id, preco, preco_promo, estoque, tamanhos, status, destaque, badge, imagem_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      nome,
      descricao,
      categoria_id,
      preco,
      preco_promo || null,
      estoque,
      tamanhos || [],
      status || 'ativo',
      destaque || false,
      badge || null,
      imagem_url || null
    ]
  );

  res.status(201).json(rows[0]);

} catch (err) {
  console.error(err);
  res.status(500).json({ erro: 'Erro ao criar produto.' });
}

// ── PUT /api/produtos/:id — editar (admin) ───────────────────
router.put('/:id', auth, validarProduto, async (req, res) => {
  const erros = validationResult(req);
  if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

  const { nome, descricao, categoria_id, preco, preco_promo,
          estoque, tamanhos, status, destaque, badge, imagem_url } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE produtos SET
        nome=$1, descricao=$2, categoria_id=$3, preco=$4,
        preco_promo=$5, estoque=$6, tamanhos=$7, status=$8,
        destaque=$9, badge=$10, imagem_url=$11
       WHERE id=$12 RETURNING *`,
      [nome, descricao, categoria_id, preco, preco_promo || null,
       estoque, tamanhos || [], status, destaque || false, badge || null,
       imagem_url || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
});

// ── PATCH /api/produtos/:id/promo — só o preço promo (admin) ─
router.patch('/:id/promo', auth, async (req, res) => {
  const { preco_promo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE produtos SET preco_promo=$1 WHERE id=$2 RETURNING *',
      [preco_promo || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar promoção.' });
  }
});

// ── PATCH /api/produtos/:id/estoque — só o estoque (admin) ───
router.patch('/:id/estoque', auth, async (req, res) => {
  const { estoque } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE produtos SET estoque=$1 WHERE id=$2 RETURNING *',
      [estoque, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar estoque.' });
  }
});

// ── DELETE /api/produtos/:id — excluir (admin) ───────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM produtos WHERE id=$1', [req.params.id]);
    res.json({ mensagem: 'Produto excluído.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir produto.' });
  }
});

module.exports = router;
