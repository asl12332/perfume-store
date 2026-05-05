function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.redirect('/auth/login?error=unauthorized');
  }
  next();
}

function setLocals(req, res, next) {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.role
  } : null;
  next();
}

module.exports = { requireLogin, requireAdmin, setLocals };
