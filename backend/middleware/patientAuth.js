import jwt from 'jsonwebtoken';

export function authenticatePatient(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please verify your phone number first.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'patient' || !decoded.phone) {
      return res.status(401).json({ error: 'Please verify your phone number first.' });
    }
    req.patient = { phone: decoded.phone };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please verify your phone number again.' });
  }
}
