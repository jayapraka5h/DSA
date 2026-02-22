const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    const db = getDb();

    // Fetch user (without password)
    const user = await db.get('SELECT id, username, email FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
         return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
     return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
};
