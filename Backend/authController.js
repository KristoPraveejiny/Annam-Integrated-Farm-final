import { pool } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { sendEmail } from './services/emailService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';
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


export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;
  const roleMap = {
    "Super Admin": "super_admin",
    "Manager": "farm_manager",
    "Farmer": "worker",
    "Customer": "customer",
  };
  const normalizedRole = roleMap[role] || role.toLowerCase();
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Ensure the users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let result;
    try {
      result = await pool.query(
        'INSERT INTO app_users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role',
        [name, email, hashedPassword, normalizedRole]
      );
    } catch (e) {
      // Unique constraint violation (duplicate email)
      if (e.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw e; // rethrow other DB errors
    }
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.status(201).json({ token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await pool.query('SELECT id, full_name, email, password_hash, role FROM app_users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function refreshToken(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const newToken = jwt.sign({ userId: payload.userId, role: payload.role }, JWT_SECRET);
    res.json({ token: newToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function logout(_req, res) {
  // With JWT, logout is handled client‑side by deleting the token.
  res.json({ message: 'Logged out' });
}
