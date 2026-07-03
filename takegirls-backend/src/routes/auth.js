const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, admin.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, nome: admin.nome },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: { id: admin.id, email: admin.email, nome: admin.nome },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /api/auth/setup  ← roda UMA vez para criar o primeiro admin
router.post('/setup', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(rows[0].count) > 0) {
      return res.status(403).json({ erro: 'Setup já foi realizado.' });
    }

    const email = process.env.ADMIN_EMAIL || 'admin@takegirls.com';
    const senha = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      'INSERT INTO admins (email, senha_hash, nome) VALUES ($1, $2, $3)',
      [email, hash, 'Admin Take Girls']
    );

    res.json({ mensagem: `Admin criado com sucesso! Email: ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar admin.' });
  }
});

module.exports = router;
