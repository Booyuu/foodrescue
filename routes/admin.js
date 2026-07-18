const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('Admin'));

router.get('/', async (_req, res) => {
  const [[stats]] = await db.execute(
    `SELECT COUNT(*) total_donations,
       COALESCE(SUM(meals_estimate),0) total_meals,
       COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') THEN meals_estimate ELSE 0 END),0) meals_saved,
       SUM(status='Available') active_listings,
       SUM(status='Completed') completed_collections,
       COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') THEN meals_estimate * 0.65 ELSE 0 END),0) co2_saved,
       COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN meals_estimate ELSE 0 END),0) saved_week,
       COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN meals_estimate ELSE 0 END),0) saved_month
     FROM food_listings`
  );
  const [[userStats]] = await db.execute(
    `SELECT SUM(role='Volunteer' AND is_active=TRUE) active_volunteers,
            SUM(role='Donor' AND is_verified=FALSE AND is_active=TRUE) pending_donors
     FROM users`
  );
  const [chart] = await db.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') month_key, DATE_FORMAT(created_at, '%b') month,
            COUNT(*) donations, COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') THEN meals_estimate ELSE 0 END),0) meals
     FROM food_listings WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
     GROUP BY month_key, month ORDER BY month_key`
  );
  const [recent] = await db.execute(
    `SELECT f.*, u.name donor_name FROM food_listings f JOIN users u ON u.user_id=f.donor_id ORDER BY f.created_at DESC LIMIT 8`
  );
  const [leaderboard] = await db.execute(
    `SELECT u.name, COUNT(c.claim_id) collections, COALESCE(SUM(f.meals_estimate),0) meals
     FROM users u LEFT JOIN collection_claims c ON c.volunteer_id=u.user_id AND c.collection_status='Delivered'
     LEFT JOIN food_listings f ON f.listing_id=c.listing_id WHERE u.role='Volunteer' AND u.is_active=TRUE
     GROUP BY u.user_id, u.name ORDER BY collections DESC, meals DESC LIMIT 5`
  );
  res.render('admin/index', { title: 'Impact overview', stats: { ...stats, ...userStats }, chart, recent, leaderboard });
});

router.get('/users', async (req, res) => {
  const values = [];
  const where = [];
  if (req.query.role) { where.push('role=?'); values.push(req.query.role); }
  if (req.query.q) { where.push('(name LIKE ? OR email LIKE ?)'); values.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const [users] = await db.execute(`SELECT user_id, name, email, mobile_number, role, is_verified, is_active, created_at FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`, values);
  res.render('admin/users', { title: 'Manage users', users, filters: req.query });
});

router.post('/users/:id/verify', async (req, res) => {
  await db.execute(`UPDATE users SET is_verified=TRUE WHERE user_id=? AND role='Donor'`, [req.params.id]);
  req.flash('success', 'Donor account verified.');
  res.redirect('/admin/users');
});

router.post('/users/:id/toggle', async (req, res) => {
  if (Number(req.params.id) === req.session.user.user_id) { req.flash('error', 'You cannot deactivate your own account.'); return res.redirect('/admin/users'); }
  await db.execute(`UPDATE users SET is_active=NOT is_active WHERE user_id=?`, [req.params.id]);
  req.flash('success', 'User access updated.');
  res.redirect('/admin/users');
});

router.get('/listings', async (req, res) => {
  const values = [];
  const where = [];
  if (req.query.status) { where.push('f.status=?'); values.push(req.query.status); }
  if (req.query.q) { where.push('(f.food_name LIKE ? OR u.name LIKE ?)'); values.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const [listings] = await db.execute(
    `SELECT f.*, u.name donor_name FROM food_listings f JOIN users u ON u.user_id=f.donor_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY f.created_at DESC`, values
  );
  res.render('admin/listings', { title: 'Manage listings', listings, filters: req.query });
});

router.delete('/listings/:id', async (req, res) => {
  await db.execute('DELETE FROM food_listings WHERE listing_id=?', [req.params.id]);
  req.flash('success', 'Listing removed.');
  res.redirect('/admin/listings');
});

module.exports = router;
