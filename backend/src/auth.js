const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "pulsecliente-dev-secret";
const JWT_EXPIRES_IN = "12h";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token ausente." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalido ou expirado." });
  }
}

function requireRole(roles) {
  return function roleGuard(req, res, next) {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Sem permissao para esta operacao." });
    }
    return next();
  };
}

module.exports = {
  signToken,
  requireAuth,
  requireRole
};
