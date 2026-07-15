const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();


// POST /api/auth/login
router.post('/login', auth, async (req, res) => {
 let { telefone, senha } = req.body;

telefone = telefone.replace(/\D/g, '');

  console.log("LOGIN RECEBIDO:", telefone, senha);

  if (!telefone || !senha) {
    return res.status(400).json({ erro: 'Telefone e senha são obrigatórios.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE telefone = $1',
      [telefone.trim()]
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const senhaCorreta = await bcrypt.compare(
      senha,
      admin.senha_hash
    );

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }


    const token = jwt.sign(
      {
        id: admin.id,
        telefone: admin.telefone,
        nome: admin.nome
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '8h'
      }
    );


    res.json({
      token,
      admin: {
        id: admin.id,
        telefone: admin.telefone,
        nome: admin.nome
      }
    });


  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});




// POST /api/auth/setup
// Cria os dois administradores
router.post('/setup', auth, async (req, res) => {
  try {

    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM admins'
    );

    if (parseInt(rows[0].count) > 0) {
      return res.status(403).json({
        erro: 'Administradores já cadastrados.'
      });
    }


    const senha1 = await bcrypt.hash('admin123', 10);
    const senha2 = await bcrypt.hash('admin456', 10);


    await pool.query(
      `
      INSERT INTO admins 
      (nome, telefone, senha_hash)
      VALUES 
      ($1, $2, $3),
      ($4, $5, $6)
      `,
      [
        'Admin Take Girls',
        '42999999999',
        senha1,

        'Administrador 2',
        '42888888888',
        senha2
      ]
    );


    res.json({
      mensagem: 'Dois administradores criados com sucesso!',
      admins: [
        {
          telefone: '42999999999',
          senha: 'admin123'
        },
        {
          telefone: '42888888888',
          senha: 'admin456'
        }
      ]
    });


  } catch (err) {

    console.error(err);

    res.status(500).json({
      erro: 'Erro ao criar administradores.'
    });

  }
});


module.exports = router;