# Community Food Rescue

A full-stack C237 CA2 web application that connects surplus-food donors with volunteers. It uses the course stack: Node.js, Express, EJS, MySQL, sessions, and server-rendered JavaScript.

## Main features

- Donor and volunteer registration, secure bcrypt login, sessions, and role-based access
- Admin donor verification, user access control, and listing moderation
- Donation CRUD with image upload, validation, ownership checks, and automatic expiry
- Search, category/location/expiry filters, sorting, and pagination
- Race-safe volunteer claiming with `SELECT ... FOR UPDATE` transactions
- Accepted → Collected → Delivered → Completed tracking
- QR handover code and optional email notification when a listing is claimed
- Leaflet/OpenStreetMap pickup map when coordinates are supplied
- Live expiry countdowns, dark mode, responsive UI, and accessible form labels
- Statistics dashboard, Chart.js graph, CO₂ estimate, and volunteer leaderboard

## Set up locally

1. Install Node.js 18+ and MySQL 8.
2. Import `database.sql` in MySQL Workbench.
3. Copy `.env.example` to `.env` and update the database values.
4. Keep `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`; the app creates or refreshes that administrator when it starts.
5. Install and run:

   ```powershell
   npm install
   npm run dev
   ```

6. Open `http://localhost:3000`.

Donor accounts require admin verification before they can publish. Volunteer accounts can browse and claim immediately.

## Optional email notifications

Fill in the `SMTP_*` values in `.env`. If they are blank, claims still work normally and email sending is skipped.

## Database flow examples for presentation

- Create donation: donor submits `/donations` → validation and Multer image handling → parameterised `INSERT` → dashboard response.
- Claim donation: volunteer posts `/volunteer/claim/:id` → row lock inside a transaction → claim `INSERT` and listing `UPDATE` → collection page.
- Update collection: volunteer posts the next status → transition check → claim and listing updates in one transaction → updated timeline.
- Admin verification: admin posts `/admin/users/:id/verify` → role-protected parameterised `UPDATE` → donor can create listings.

## Deployment notes

- Set `NODE_ENV=production` and a long random `SESSION_SECRET`.
- Use a persistent disk or cloud image service in production because Render's local filesystem is ephemeral.
- Use a shared MySQL host and configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
- The default session memory store is suitable for coursework/local demos; use a MySQL or Redis session store for a multi-instance production deployment.
