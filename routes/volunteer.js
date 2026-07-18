const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendClaimNotification } = require('../services/email');

const router = express.Router();
router.use(requireAuth, requireRole('Volunteer'));

router.post('/claim/:listingId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT f.*, d.name AS donor_name, d.email AS donor_email
       FROM food_listings f JOIN users d ON d.user_id=f.donor_id
       WHERE f.listing_id=? FOR UPDATE`, [req.params.listingId]
    );
    const listing = rows[0];
    if (!listing || listing.status !== 'Available' || new Date(listing.expiry_date) <= new Date()) {
      await connection.rollback();
      req.flash('error', 'This donation is no longer available.');
      return res.redirect('/donations');
    }
    const confirmationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await connection.execute(
      `INSERT INTO collection_claims (listing_id, volunteer_id, confirmation_code) VALUES (?, ?, ?)`,
      [listing.listing_id, req.session.user.user_id, confirmationCode]
    );
    await connection.execute(`UPDATE food_listings SET status='Claimed' WHERE listing_id=?`, [listing.listing_id]);
    await connection.commit();

    sendClaimNotification({
      donorEmail: listing.donor_email,
      donorName: listing.donor_name,
      foodName: listing.food_name,
      volunteerName: req.session.user.name
    }).catch((error) => console.error('Claim email could not be sent:', error.message));

    req.flash('success', `Collection accepted. Confirmation code: ${confirmationCode}`);
    return res.redirect(`/volunteer/claims/${listing.listing_id}`);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Another volunteer claimed this donation first.');
      return res.redirect('/donations');
    }
    throw error;
  } finally {
    connection.release();
  }
});

router.get('/claims/:listingId', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.*, f.*, d.name AS donor_name, d.mobile_number AS donor_mobile, d.email AS donor_email
     FROM collection_claims c JOIN food_listings f ON f.listing_id=c.listing_id
     JOIN users d ON d.user_id=f.donor_id
     WHERE c.listing_id=? AND c.volunteer_id=?`, [req.params.listingId, req.session.user.user_id]
  );
  if (!rows[0]) return res.status(404).render('error', { title: 'Claim not found', status: 404, message: 'This collection job is not assigned to you.' });
  const qrCode = await QRCode.toDataURL(`CFR:${rows[0].listing_id}:${rows[0].confirmation_code}`, { width: 240, margin: 1, color: { dark: '#18352b', light: '#ffffff' } });
  res.render('volunteer/claim', { title: 'Collection details', claim: rows[0], qrCode });
});

router.post('/claims/:listingId/status', async (req, res) => {
  const allowedTransitions = { Accepted: 'Collected', Collected: 'Delivered' };
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT * FROM collection_claims WHERE listing_id=? AND volunteer_id=? FOR UPDATE`,
      [req.params.listingId, req.session.user.user_id]
    );
    const claim = rows[0];
    const newStatus = req.body.status;
    if (!claim || allowedTransitions[claim.collection_status] !== newStatus) {
      await connection.rollback();
      req.flash('error', 'That status change is not allowed.');
      return res.redirect(`/volunteer/claims/${req.params.listingId}`);
    }
    const timeField = newStatus === 'Collected' ? 'collection_time' : 'delivery_time';
    await connection.execute(`UPDATE collection_claims SET collection_status=?, ${timeField}=NOW() WHERE claim_id=?`, [newStatus, claim.claim_id]);
    await connection.execute(`UPDATE food_listings SET status=? WHERE listing_id=?`, [newStatus, claim.listing_id]);
    await connection.commit();
    req.flash('success', `Collection status updated to ${newStatus}.`);
    return res.redirect(`/volunteer/claims/${req.params.listingId}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = router;
