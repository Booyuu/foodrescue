require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('express-flash');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const { requireAuth } = require('./middleware/auth');
const { expireListings } = require('./utils/listings');

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true
});
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'foodrescue.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === 'production',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  res.locals.formatDate = (value, withTime = true) => {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    return new Intl.DateTimeFormat('en-SG', {
      dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {})
    }).format(date);
  };
  next();
});

app.use(async (req, _res, next) => {
  try {
    await expireListings(db);
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/', async (req, res) => {
  const [featured] = await db.execute(
    `SELECT f.*, u.name AS donor_name
     FROM food_listings f JOIN users u ON u.user_id = f.donor_id
     WHERE f.status = 'Available' AND f.expiry_date > NOW()
     ORDER BY f.expiry_date ASC LIMIT 6`
  );
  const [[stats]] = await db.execute(
    `SELECT COUNT(*) AS total_donations,
            COALESCE(SUM(CASE WHEN status IN ('Delivered','Completed') THEN meals_estimate ELSE 0 END), 0) AS meals_saved,
            SUM(status = 'Available') AS active_listings,
            SUM(status = 'Completed') AS completed
     FROM food_listings`
  );
  res.render('home', { title: 'Rescue good food. Feed the community.', featured, stats });
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const userId = req.session.user.user_id;
  if (req.session.user.role === 'Admin') return res.redirect('/admin');

  if (req.session.user.role === 'Donor') {
    const [listings] = await db.execute(
      `SELECT f.*, c.collection_status, c.confirmation_code, v.name AS volunteer_name
       FROM food_listings f
       LEFT JOIN collection_claims c ON c.listing_id = f.listing_id
       LEFT JOIN users v ON v.user_id = c.volunteer_id
       WHERE f.donor_id = ? ORDER BY f.created_at DESC`, [userId]
    );
    const summary = listings.reduce((acc, item) => {
      acc.total += 1;
      acc.meals += item.meals_estimate;
      if (item.status === 'Available') acc.active += 1;
      if (item.status === 'Completed') acc.completed += 1;
      return acc;
    }, { total: 0, meals: 0, active: 0, completed: 0 });
    return res.render('dashboard', { title: 'Donor dashboard', listings, claims: [], summary });
  }

  const [claims] = await db.execute(
    `SELECT c.*, f.*, d.name AS donor_name, d.mobile_number AS donor_mobile
     FROM collection_claims c
     JOIN food_listings f ON f.listing_id = c.listing_id
     JOIN users d ON d.user_id = f.donor_id
     WHERE c.volunteer_id = ? ORDER BY c.created_at DESC`, [userId]
  );
  const summary = claims.reduce((acc, item) => {
    acc.total += 1;
    acc.meals += item.meals_estimate;
    if (item.collection_status === 'Accepted') acc.active += 1;
    if (item.collection_status === 'Delivered') acc.completed += 1;
    return acc;
  }, { total: 0, meals: 0, active: 0, completed: 0 });
  return res.render('dashboard', { title: 'Volunteer dashboard', listings: [], claims, summary });
});

app.use('/', require('./routes/auth'));
app.use('/donations', require('./routes/donations'));
app.use('/volunteer', require('./routes/volunteer'));
app.use('/admin', require('./routes/admin'));

app.use((_req, res) => res.status(404).render('error', { title: 'Page not found', status: 404, message: 'The page you requested could not be found.' }));
app.use((error, req, res, _next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'Image must be 5 MB or smaller.');
    return res.redirect(req.get('referer') || '/dashboard');
  }
  if (error.message?.startsWith('Only JPG')) {
    req.flash('error', error.message);
    return res.redirect(req.get('referer') || '/dashboard');
  }
  return res.status(500).render('error', { title: 'Something went wrong', status: 500, message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again shortly.' });
});

async function ensureAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await db.execute(
    `INSERT INTO users (name, email, mobile_number, password_hash, role, is_verified)
     VALUES ('System Administrator', ?, '00000000', ?, 'Admin', TRUE)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'Admin', is_verified = TRUE`,
    [process.env.ADMIN_EMAIL.toLowerCase(), hash]
  );
}

if (require.main === module) {
  ensureAdmin()
    .then(() => app.listen(port, () => console.log(`Community Food Rescue is running at http://localhost:${port}`)))
    .catch((error) => {
      console.error('Unable to start. Check your MySQL settings:', error.message);
      process.exit(1);
    });
}

module.exports = app;
