const prisma = require('../config/database');

// Ensure user is logged in
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/login');
}

// Ensure admin role
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Admin access required');
  res.redirect('/dashboard');
}

// Ensure accountant role
function ensureAccountant(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && 
      (req.user?.role === 'accountant' || req.user?.role === 'admin')) {
    return next();
  }
  req.flash('error_msg', 'Accountant access required');
  res.redirect('/dashboard');
}

// Ensure owner or admin
function ensureOwner(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && 
      (req.user?.role === 'owner' || req.user?.role === 'admin')) {
    return next();
  }
  req.flash('error_msg', 'Owner access required');
  res.redirect('/dashboard');
}

// Ensure not pending
function ensureNotPending(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.role !== 'pending') {
    return next();
  }
  req.flash('error_msg', 'Your account is pending approval. Please contact the admin.');
  res.redirect('/pending');
}

// Can view financials (owner, accountant, admin)
function canViewFinancials(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && 
      ['owner', 'accountant', 'admin'].includes(req.user?.role)) {
    return next();
  }
  req.flash('error_msg', 'Financial data is restricted to authorized users');
  res.redirect('/dashboard');
}

// Can manage ledger (accountant, admin)
function canManageLedger(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && 
      ['accountant', 'admin'].includes(req.user?.role)) {
    return next();
  }
  req.flash('error_msg', 'You do not have permission to manage ledger entries');
  res.redirect('/expenses');
}

// Load user into req.user from session
async function loadUser(req, res, next) {
  if (req.session?.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, photoUrl: true, phone: true,
          createdAt: true, lastLogin: true,
        },
      });
      if (user) {
        req.user = user;
        res.locals.user = user;
      }
    } catch (err) {
      console.error('Load user error:', err);
    }
  }
  next();
}

module.exports = {
  ensureAuth,
  ensureAdmin,
  ensureAccountant,
  ensureOwner,
  ensureNotPending,
  canViewFinancials,
  canManageLedger,
  loadUser,
};
