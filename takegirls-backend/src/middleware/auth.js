const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  console.log("AUTH HEADER:", authHeader);
  console.log("SECRET EXISTE:", !!process.env.JWT_SECRET);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    console.log("TOKEN OK:", payload);

    req.admin = payload;
    next();

  } catch (err) {
    console.log("ERRO JWT:", err.message);

    return res.status(401).json({
      erro: 'Token inválido ou expirado.'
    });
  }
}

module.exports = authMiddleware;