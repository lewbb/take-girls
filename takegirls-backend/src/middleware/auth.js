const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
} catch (err) {
  console.error("JWT ERROR:", err.message);
  console.error("JWT_SECRET:", process.env.JWT_SECRET);

  return res.status(401).json({
    erro: "Token inválido ou expirado."
  });
}
}

module.exports = authMiddleware;
