import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from './db.js';
import { sendEmail } from './services/emailService.js';

const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 12) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function passwordValidationMessage() {
  return 'Password must be 8-12 characters and include uppercase, lowercase, number, and special character.';
}

export async function sendPasswordResetOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userRes = await pool.query(
      'SELECT id, full_name, email FROM app_users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const user = userRes.rows[0];
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO auth_verification_codes (user_id, purpose, target_value, code_hash, expires_at, attempts)
       VALUES ($1, 'password_reset', $2, $3, $4, 0)`,
      [user.id, user.email.toLowerCase(), otpHash, expiresAt]
    );

    const html = `
      <h2>Password Reset OTP</h2>
      <p>Hello ${user.full_name || 'User'},</p>
      <p>Your password reset OTP is <strong>${otp}</strong>.</p>
      <p>This OTP is valid for ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Annam Integrated Farm Password Reset OTP',
      text: html.replace(/<[^>]+>/g, ''),
      html,
    });

    return res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('sendPasswordResetOtp error:', err);
    return res.status(500).json({ error: 'Failed to send password reset OTP' });
  }
}

export async function resetPasswordWithOtp(req, res) {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email, OTP, new password, and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: passwordValidationMessage() });
    }

    const userRes = await pool.query(
      'SELECT id, email FROM app_users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const user = userRes.rows[0];
    const codeRes = await pool.query(
      `SELECT id, code_hash, expires_at, attempts
       FROM auth_verification_codes
       WHERE user_id = $1 AND purpose = 'password_reset' AND target_value = $2 AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, user.email.toLowerCase()]
    );

    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: 'No valid reset OTP found. Please request a new one.' });
    }

    const codeRow = codeRes.rows[0];
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (codeRow.attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
    }

    if (hashOtp(String(otp).trim()) !== codeRow.code_hash) {
      await pool.query('UPDATE auth_verification_codes SET attempts = attempts + 1 WHERE id = $1', [codeRow.id]);
      return res.status(400).json({ error: 'Incorrect OTP.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE app_users SET password_hash = $1, updated_at = now() WHERE id = $2', [hashedPassword, user.id]);
    await pool.query('UPDATE auth_verification_codes SET verified_at = now() WHERE id = $1', [codeRow.id]);

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('resetPasswordWithOtp error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
