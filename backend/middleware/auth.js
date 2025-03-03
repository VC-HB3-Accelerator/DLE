const { checkAccess } = require('../utils/access-check');

// Middleware для проверки роли
const requireRole = (requiredRole) => async (req, res, next) => {
  try {
    const address = req.headers['x-wallet-address'];
    if (!address) {
      return res.status(401).json({ error: 'No wallet address' });
    }

    const { hasAccess, role } = await checkAccess(address);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'No access token' });
    }

    if (requiredRole && role !== requiredRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Добавляем информацию о роли в request
    req.userRole = role;
    next();
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Auth check failed' });
  }
};

module.exports = {
  requireRole
}; 