// src/middleware/auth.js
import jwt from 'jsonwebtoken';

/** 1) Attach req.user if a valid JWT cookie exists */
export function attachUser(req, res, next) {
  const token = req.cookies?.token;
  if (!token) { req.user = null; res.locals.user = null; return next(); }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;            // { sub, email, role, ... }
    res.locals.user = payload;     // for EJS
  } catch {
    req.user = null;
    res.locals.user = null;
  }
  next();
}

/** 2) Block if not authenticated */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/** 3) Block if role not allowed */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role || req.user.Role || req.user.RoleName;
    if (!roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
