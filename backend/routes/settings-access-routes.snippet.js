// --- Access overlay routes (my-screen-access / my-action-access) ---
const roleActionCapabilitiesService = require('../services/roleActionCapabilitiesService');
const roleScreenCapabilitiesService = require('../services/roleScreenCapabilitiesService');

async function resolveSessionScreenRole(req) {
  if (!req.session?.authenticated || !req.session?.userId) return 'guest';
  const cached = req.session.userAccessLevel?.level;
  if (cached === 'readonly' || cached === 'editor') return cached;
  try {
    if (req.session.authType === 'wallet' && req.session.address) {
      const authService = require('../services/auth-service');
      const level = await authService.getUserAccessLevel(req.session.address);
      req.session.userAccessLevel = level;
      if (level?.level === 'readonly' || level?.level === 'editor') return level.level;
      return 'guest';
    }
    const roleResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    const role = roleResult.rows[0]?.role;
    if (role === 'editor' || role === 'readonly') return role;
  } catch (err) {
    logger.warn('[Settings] resolveSessionScreenRole:', err.message);
  }
  return 'guest';
}

async function resolveSessionActionRole(req) {
  if (!req.session?.authenticated || !req.session?.userId) return 'guest';
  try {
    if (req.session.authType === 'wallet' && req.session.address) {
      const authService = require('../services/auth-service');
      const level = await authService.getUserAccessLevel(req.session.address);
      req.session.userAccessLevel = level;
      if (level?.level === 'readonly' || level?.level === 'editor') return level.level;
      return 'user';
    }
    const cached = req.session.userAccessLevel?.level;
    if (cached === 'readonly' || cached === 'editor' || cached === 'user') return cached;
    const roleResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    const role = roleResult.rows[0]?.role;
    if (role === 'editor' || role === 'readonly' || role === 'user') return role;
  } catch (err) {
    logger.warn('[Settings] resolveSessionActionRole:', err.message);
  }
  return 'user';
}

router.get('/my-screen-access', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = await resolveSessionScreenRole(req);
    const screens = await roleScreenCapabilitiesService.getScreensForUi(role);
    res.json({
      success: true,
      data: {
        role: roleScreenCapabilitiesService.roleKeyForScreens(role),
        screens
      }
    });
  } catch (error) {
    logger.error('[Settings] my-screen-access GET:', error);
    res.status(500).json({ success: false, error: 'Не удалось загрузить доступ к экранам' });
  }
});

router.get('/my-action-access', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = await resolveSessionActionRole(req);
    const actions = await roleActionCapabilitiesService.getActionsForUi(role);
    res.json({
      success: true,
      data: {
        role: roleActionCapabilitiesService.roleKeyForActions(role),
        actions
      }
    });
  } catch (error) {
    logger.error('[Settings] my-action-access GET:', error);
    res.status(500).json({ success: false, error: 'Не удалось загрузить права на действия' });
  }
});
