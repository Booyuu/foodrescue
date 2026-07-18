const nodemailer = require('nodemailer');

async function sendClaimNotification({ donorEmail, donorName, foodName, volunteerName }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Community Food Rescue <no-reply@foodrescue.sg>',
    to: donorEmail,
    subject: `Your ${foodName} donation has been claimed`,
    text: `Hi ${donorName}, ${volunteerName} has accepted your ${foodName} collection. You can track its status from your dashboard.`
  });
  return true;
}

module.exports = { sendClaimNotification };
