const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { ensureAuth, ensureNotPending } = require('../middleware/auth');

// Login page
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login', layout: false });
});

// Login handler
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error_msg', 'Please enter email and password');
      return res.redirect('/login');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/login');
    }

    if (user.status === 'inactive') {
      req.flash('error_msg', 'Your account has been deactivated. Contact admin.');
      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/login');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Set session
    req.session.userId = user.id;

    req.flash('success_msg', `Welcome back, ${user.firstName}!`);

    if (user.role === 'pending') {
      return res.redirect('/pending');
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error_msg', 'An error occurred during login');
    res.redirect('/login');
  }
});

// Register page
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register', layout: false });
});

// Register handler
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/register');
    }

    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/register');
    }

    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect('/register');
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/register');
    }

    // Check admin/accountant lists
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const accountantEmails = (process.env.ACCOUNTANT_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

    let role = 'pending';
    if (adminEmails.includes(email.toLowerCase())) role = 'admin';
    else if (accountantEmails.includes(email.toLowerCase())) role = 'accountant';

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
        role,
        status: 'active',
      },
    });

    req.session.userId = user.id;
    req.flash('success_msg', 'Registration successful! Welcome to the portal.');

    if (role === 'pending') {
      return res.redirect('/pending');
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error_msg', 'An error occurred during registration');
    res.redirect('/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.redirect('/login');
  });
});

// Pending approval page
router.get('/pending', ensureAuth, (req, res) => {
  res.render('auth/pending', { title: 'Account Pending', layout: false });
});

// Profile page
router.get('/profile', ensureAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        ownedUnits: true,
        residentUnits: true,
      },
    });
    res.render('auth/profile', { title: 'My Profile', user });
  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error_msg', 'Unable to load profile');
    res.redirect('/dashboard');
  }
});

// Update profile
router.post('/profile', ensureAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName, phone },
    });
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', 'Unable to update profile');
    res.redirect('/profile');
  }
});

// Change password
router.post('/profile/password', ensureAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/profile');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/profile');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Password change error:', error);
    req.flash('error_msg', 'Unable to change password');
    res.redirect('/profile');
  }
});

module.exports = router;
