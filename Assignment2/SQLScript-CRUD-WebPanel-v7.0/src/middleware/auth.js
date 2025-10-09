import jwt from 'jsonwebtoken';

function readTokenFrom(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.substring(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

export default function auth(required = true) {
  return (req, res, next) => {
    const token = readTokenFrom(req);
    if (!token) {
      if (required) return res.status(401).json({ error: 'Unauthorized' });
      req.user = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // { sub, role, email, name }
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
