const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /api/pedidos — cliente cria um pedido (checkout)
router.post('/', async (req, res) => {
  const { cliente, endereco, itens, pagamento, frete, promocao_codigo } = req.body;

  if (!itens || itens.length === 0) {
    return res.status(400).json({ erro: 'O carrinho está vazio.' });
  }

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    // 1. Salva ou atualiza o cliente
    let clienteId;
    const cliExiste = await conn.query(
      'SELECT id FROM clientes WHERE email=$1', [cliente.email]
    );
    if (cliExiste.rows[0]) {
      clienteId = cliExiste.rows[0].id;
      await conn.query(
        'UPDATE clientes SET nome=$1, telefone=$2 WHERE id=$3',
        [cliente.nome, cliente.telefone, clienteId]
      );
    } else {
      const cliNovo = await conn.query(
        'INSERT INTO clientes (nome, email, telefone) VALUES ($1,$2,$3) RETURNING id',
        [cliente.nome, cliente.email, cliente.telefone]
      );
      clienteId = cliNovo.rows[0].id;
    }

    // 2. Salva endereço
    const endRes = await conn.query(
      `INSERT INTO enderecos (cliente_id, cep, rua, numero, complemento, bairro, cidade, uf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [clienteId, endereco.cep, endereco.rua, endereco.numero,
       endereco.complemento, endereco.bairro, endereco.cidade, endereco.uf]
    );
    const enderecoId = endRes.rows[0].id;

    // 3. Calcula subtotal buscando preços reais do banco
    let subtotal = 0;
    const produtosVerificados = [];
    for (const item of itens) {
      const { rows } = await conn.query(
        'SELECT id, nome, preco, preco_promo, estoque FROM produtos WHERE id=$1',
        [item.produto_id]
      );
      const prod = rows[0];
      if (!prod) throw new Error(`Produto ${item.produto_id} não encontrado.`);
      if (prod.estoque < item.quantidade) throw new Error(`Estoque insuficiente: ${prod.nome}.`);

      const precoFinal = prod.preco_promo || prod.preco;
      subtotal += precoFinal * item.quantidade;
      produtosVerificados.push({ ...item, preco: precoFinal, nome: prod.nome });
    }

    // 4. Aplica cupom
    let desconto = 0;
    let promocaoId = null;
    if (promocao_codigo) {
      const promoRes = await conn.query(
        `SELECT * FROM promocoes
         WHERE codigo=$1 AND ativa=true
           AND (validade IS NULL OR validade >= NOW())
           AND (usos_max IS NULL OR usos_atual < usos_max)`,
        [promocao_codigo.toUpperCase()]
      );
      const promo = promoRes.rows[0];
      if (promo) {
        promocaoId = promo.id;
        if (promo.tipo === 'percentual') desconto = subtotal * (promo.valor / 100);
        else if (promo.tipo === 'fixo') desconto = promo.valor;
        else if (promo.tipo === 'frete_gratis') desconto = frete;
        await conn.query(
          'UPDATE promocoes SET usos_atual = usos_atual + 1 WHERE id=$1', [promo.id]
        );
      }
    }

    const total = subtotal + (frete || 0) - desconto;

    // 5. Cria o pedido
    const pedidoRes = await conn.query(
      `INSERT INTO pedidos
        (cliente_id, endereco_id, pagamento, subtotal, frete, desconto, total, promocao_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [clienteId, enderecoId, pagamento, subtotal, frete || 0, desconto, total, promocaoId]
    );
    const pedido = pedidoRes.rows[0];

    // 6. Salva os itens e baixa estoque
    for (const item of produtosVerificados) {
      await conn.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, nome_snapshot, preco_snapshot, quantidade, tamanho)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [pedido.id, item.produto_id, item.nome, item.preco, item.quantidade, item.tamanho || null]
      );
      await conn.query(
        'UPDATE produtos SET estoque = estoque - $1 WHERE id=$2',
        [item.quantidade, item.produto_id]
      );
    }

    await conn.query('COMMIT');

    res.status(201).json({
      codigo: pedido.codigo,
      total: pedido.total,
      mensagem: 'Pedido criado com sucesso!',
    });
  } catch (err) {
    await conn.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ erro: err.message || 'Erro ao criar pedido.' });
  } finally {
    conn.release();
  }
});

// GET /api/pedidos — lista todos (admin)
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, cl.nome AS cliente_nome, cl.email AS cliente_email, cl.telefone
      FROM pedidos p
      JOIN clientes cl ON cl.id = p.cliente_id
      ORDER BY p.criado_em DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

// GET /api/pedidos/:codigo — detalhe de um pedido
router.get('/:codigo', auth, async (req, res) => {
  try {
    const { rows: [pedido] } = await pool.query(
      `SELECT p.*, cl.nome AS cliente_nome, cl.email, cl.telefone,
              e.cep, e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.uf
       FROM pedidos p
       JOIN clientes cl ON cl.id = p.cliente_id
       JOIN enderecos e ON e.id = p.endereco_id
       WHERE p.codigo = $1`,
      [req.params.codigo]
    );
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    const { rows: itens } = await pool.query(
      'SELECT * FROM pedido_itens WHERE pedido_id=$1', [pedido.id]
    );
    res.json({ ...pedido, itens });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedido.' });
  }
});

// PATCH /api/pedidos/:codigo/status — atualiza status (admin)
router.patch('/:codigo/status', auth, async (req, res) => {
  const { status } = req.body;
  const statusValidos = ['pendente','pago','em_separacao','enviado','entregue','cancelado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE pedidos SET status=$1 WHERE codigo=$2 RETURNING *',
      [status, req.params.codigo]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status.' });
  }
});

module.exports = router;
