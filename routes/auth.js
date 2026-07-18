const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const router = express.Router();

router.get('/register', (req, res) => res.render('auth/register', { title: 'Create account', formData: {} }));

router.post('/register', async (req, res) => {
  const { name, email, mobile_number, password, confirm_password, role } = req.body;
  const errors = [];
  if (!name || !email || !mobile_number || !password || !role) errors.push('All fields are required.');
  if (!['Donor', 'Volunteer'].includes(role)) errors.push('Please select a valid role.');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) errors.push('Enter a valid email address.');
  if (!/^[+\d][\d\s-]{7,19}$/.test(mobile_number || '')) errors.push('Enter a valid mobile number.');
  if ((password || '').length < 8) errors.push('Password must contain at least 8 characters.');
  if (password !== confirm_password) errors.push('Passwords do not match.');
  if (errors.length) return res.status(400).render('auth/register', { title: 'Create account', formData: req.body, inlineErrors: errors });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const isVerified = role === 'Volunteer';
    await db.execute(
      `INSERT INTO users (name, email, mobile_number, password_hash, role, is_verified)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), mobile_number.trim(), passwordHash, role, isVerified]
    );
    req.flash('success', role === 'Donor' ? 'Account created. An administrator must verify you before you can post donations.' : 'Account created. You can now log in.');
    return res.redirect('/login');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).render('auth/register', { title: 'Create account', formData: req.body, inlineErrors: ['An account with that email already exists.'] });
    throw error;
  }
});

router.get('/login', (req, res) => res.render('auth/login', { title: 'Welcome back', next: req.query.next || '' }));

router.post('/login', async (req, res) => {
  const { email, password, next } = req.body;
  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/login');
  }
  const [users] = await db.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
  const user = users[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    req.flash('error', 'Invalid email or password.');
    return res.redirect('/login');
  }
  req.session.user = {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    mobile_number: user.mobile_number,
    role: user.role,
    is_verified: Boolean(user.is_verified)
  };
  req.flash('success', `Welcome back, ${user.name.split(' ')[0]}!`);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return res.redirect(safeNext);
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

module.exports = router;
