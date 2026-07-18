function requireAuth(req, res, next) {
  if (req.session.user) return next();
  req.flash('error', 'Please log in to continue.');
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'Please log in to continue.');
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      req.flash('error', 'You do not have permission to access that page.');
      return res.redirect('/dashboard');
    }
    return next();
  };
}

function requireVerifiedDonor(req, res, next) {
  if (req.session.user?.role !== 'Donor') {
    req.flash('error', 'Only donors can create food listings.');
    return res.redirect('/dashboard');
  }
  if (!req.session.user.is_verified) {
    req.flash('error', 'Your donor account is awaiting administrator verification.');
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = { requireAuth, requireRole, requireVerifiedDonor };
