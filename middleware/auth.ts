const jwt = require('jsonwebtoken');
const JWT_TOKEN_SECRET = process.env.JWT_TOKEN_SECRET;

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.header('Authorization');
  if (!token) {
    res.status(401).send('Access Denied');
    return false;
  }

  const tokenString = token.split(' ')[1];
  try {
    const verified = jwt.verify(tokenString, JWT_TOKEN_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(200).send({ message: 'Invalid Token', isInvalidToken: true });
  }
};

module.exports = authMiddleware;