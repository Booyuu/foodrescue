const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const db = require('../config/db');
const upload = require('../middleware/upload');
const { requireAuth, requireRole, requireVerifiedDonor } = require('../middleware/auth');
const { estimateMeals, validateListing } = require('../utils/listings');

const router = express.Router();
const PAGE_SIZE = 9;

router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const values = [];
  const filters = [`f.status = 'Available'`, 'f.expiry_date > NOW()'];
  if (req.query.q) {
    filters.push('(f.food_name LIKE ? OR f.description LIKE ? OR f.pickup_address LIKE ?)');
    const term = `%${req.query.q}%`;
    values.push(term, term, term);
  }
  if (req.query.category) { filters.push('f.food_category = ?'); values.push(req.query.category); }
  if (req.query.location) { filters.push('f.pickup_address LIKE ?'); values.push(`%${req.query.location}%`); }
  if (req.query.expiry === 'today') filters.push('DATE(f.expiry_date) = CURDATE()');
  if (req.query.expiry === '24hours') filters.push('f.expiry_date <= DATE_ADD(NOW(), INTERVAL 24 HOUR)');
  const where = filters.join(' AND ');
  const [[count]] = await db.execute(`SELECT COUNT(*) AS total FROM food_listings f WHERE ${where}`, values);
  const sort = req.query.sort === 'newest' ? 'f.created_at DESC' : 'f.expiry_date ASC';
  const [listings] = await db.execute(
    `SELECT f.*, u.name AS donor_name FROM food_listings f JOIN users u ON u.user_id = f.donor_id
     WHERE ${where} ORDER BY ${sort} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, values
  );
  res.render('donations/index', { title: 'Available food', listings, filters: req.query, page, pages: Math.ceil(count.total / PAGE_SIZE) });
});

router.get('/new', requireAuth, requireVerifiedDonor, (req, res) => res.render('donations/form', { title: 'Share surplus food', listing: {}, action: '/donations', submitLabel: 'Publish donation' }));

router.post('/', requireAuth, requireVerifiedDonor, upload.single('image'), async (req, res) => {
  const errors = validateListing(req.body);
  if (errors.length) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).render('donations/form', { title: 'Share surplus food', listing: req.body, action: '/donations', submitLabel: 'Publish donation', inlineErrors: errors });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const { food_name, food_category, description, quantity, pickup_address, latitude, longitude, donation_date, expiry_date } = req.body;
  await db.execute(
    `INSERT INTO food_listings
     (donor_id, food_name, food_category, description, quantity, meals_estimate, pickup_address, latitude, longitude, donation_date, expiry_date, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.user.user_id, food_name.trim(), food_category, description.trim(), quantity.trim(), estimateMeals(quantity), pickup_address.trim(), latitude || null, longitude || null, donation_date, expiry_date, imageUrl]
  );
  req.flash('success', 'Your food donation is now available to volunteers.');
  res.redirect('/dashboard');
});

router.get('/:id/edit', requireAuth, requireRole('Donor'), async (req, res) => {
  const [rows] = await db.execute(`SELECT * FROM food_listings WHERE listing_id = ? AND donor_id = ?`, [req.params.id, req.session.user.user_id]);
  const listing = rows[0];
  if (!listing) return res.status(404).render('error', { title: 'Listing not found', status: 404, message: 'This donation does not exist or is not yours.' });
  if (listing.status !== 'Available') { req.flash('error', 'Claimed donations can no longer be edited.'); return res.redirect('/dashboard'); }
  res.render('donations/form', { title: 'Edit donation', listing, action: `/donations/${listing.listing_id}?_method=PUT`, submitLabel: 'Save changes' });
});

router.put('/:id', requireAuth, requireRole('Donor'), upload.single('image'), async (req, res) => {
  const errors = validateListing(req.body);
  const [rows] = await db.execute('SELECT * FROM food_listings WHERE listing_id = ? AND donor_id = ?', [req.params.id, req.session.user.user_id]);
  const existing = rows[0];
  if (!existing || existing.status !== 'Available') { if (req.file) await fs.unlink(req.file.path).catch(() => {}); req.flash('error', 'Only your available donations can be edited.'); return res.redirect('/dashboard'); }
  if (errors.length) { if (req.file) await fs.unlink(req.file.path).catch(() => {}); return res.status(400).render('donations/form', { title: 'Edit donation', listing: { ...existing, ...req.body }, action: `/donations/${req.params.id}?_method=PUT`, submitLabel: 'Save changes', inlineErrors: errors }); }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.image_url;
  const { food_name, food_category, description, quantity, pickup_address, latitude, longitude, donation_date, expiry_date } = req.body;
  await db.execute(
    `UPDATE food_listings SET food_name=?, food_category=?, description=?, quantity=?, meals_estimate=?, pickup_address=?, latitude=?, longitude=?, donation_date=?, expiry_date=?, image_url=?
     WHERE listing_id=? AND donor_id=? AND status='Available'`,
    [food_name.trim(), food_category, description.trim(), quantity.trim(), estimateMeals(quantity), pickup_address.trim(), latitude || null, longitude || null, donation_date, expiry_date, imageUrl, req.params.id, req.session.user.user_id]
  );
  if (req.file && existing.image_url) await fs.unlink(path.join(__dirname, '..', 'public', existing.image_url)).catch(() => {});
  req.flash('success', 'Donation updated.');
  res.redirect(`/donations/${req.params.id}`);
});

router.delete('/:id', requireAuth, requireRole('Donor'), async (req, res) => {
  const [rows] = await db.execute(`SELECT image_url FROM food_listings WHERE listing_id=? AND donor_id=? AND status='Available'`, [req.params.id, req.session.user.user_id]);
  if (!rows.length) { req.flash('error', 'Only an available, unclaimed donation can be deleted.'); return res.redirect('/dashboard'); }
  await db.execute(`DELETE FROM food_listings WHERE listing_id=? AND donor_id=? AND status='Available'`, [req.params.id, req.session.user.user_id]);
  if (rows[0].image_url) await fs.unlink(path.join(__dirname, '..', 'public', rows[0].image_url)).catch(() => {});
  req.flash('success', 'Donation deleted.');
  res.redirect('/dashboard');
});

router.post('/:id/complete', requireAuth, requireRole('Donor'), async (req, res) => {
  const [result] = await db.execute(`UPDATE food_listings SET status='Completed' WHERE listing_id=? AND donor_id=? AND status IN ('Collected','Delivered')`, [req.params.id, req.session.user.user_id]);
  req.flash(result.affectedRows ? 'success' : 'error', result.affectedRows ? 'Donation marked as completed. Thank you!' : 'This donation cannot be completed yet.');
  res.redirect('/dashboard');
});

router.get('/:id', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT f.*, d.name AS donor_name, d.email AS donor_email, d.mobile_number AS donor_mobile,
            c.claim_id, c.volunteer_id, c.collection_status, c.confirmation_code, v.name AS volunteer_name
     FROM food_listings f JOIN users d ON d.user_id=f.donor_id
     LEFT JOIN collection_claims c ON c.listing_id=f.listing_id
     LEFT JOIN users v ON v.user_id=c.volunteer_id WHERE f.listing_id=?`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).render('error', { title: 'Listing not found', status: 404, message: 'This donation could not be found.' });
  res.render('donations/show', { title: rows[0].food_name, listing: rows[0] });
});

module.exports = router;
