function expireListings(db) {
  return db.execute(
    `UPDATE food_listings
     SET status = 'Expired'
     WHERE expiry_date <= NOW() AND status IN ('Available', 'Claimed')`
  );
}

function parsePositiveNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function estimateMeals(quantity) {
  return Math.max(1, Math.round(parsePositiveNumber(quantity)));
}

function validateListing(body) {
  const required = ['food_name', 'food_category', 'description', 'quantity', 'pickup_address', 'donation_date', 'expiry_date'];
  const errors = required.filter((field) => !String(body[field] || '').trim()).map((field) => `${field.replaceAll('_', ' ')} is required.`);
  if (body.expiry_date && new Date(body.expiry_date) <= new Date()) errors.push('Expiry date and time must be in the future.');
  if (body.donation_date && body.expiry_date && new Date(body.expiry_date) <= new Date(body.donation_date)) errors.push('Expiry must be after the donation date.');
  if (!parsePositiveNumber(body.quantity)) errors.push('Quantity must begin with a positive number (for example, 12 boxes).');
  return errors;
}

module.exports = { expireListings, estimateMeals, validateListing };
