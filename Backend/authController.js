import './loadEnv.js';
import { pool } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from './services/emailService.js';

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

// Only accounts an administrator has activated may sign in.
const ACCOUNT_STATUS_MESSAGES = {
  pending:
    'Your account is awaiting administrator approval. You will be able to sign in once an administrator activates your account.',
  suspended: 'Your account has been suspended. Please contact the farm administrator for assistance.',
  disabled: 'Your account has been disabled. Please contact the farm administrator for assistance.',
};

// Incoming role labels/aliases -> user_role enum values.
const ROLE_ALIASES = {
  super_admin: 'super_admin',
  'super admin': 'super_admin',
  superadmin: 'super_admin',
  admin: 'super_admin',
  farm_manager: 'farm_manager',
  'farm manager': 'farm_manager',
  manager: 'farm_manager',
  worker: 'worker',
  farmer: 'worker',
  customer: 'customer',
  guest: 'guest',
};

// Roles a visitor may choose when signing up. Privileged roles are assigned by
// an administrator, never self-selected.
const SELF_REGISTERABLE_ROLES = new Set(['worker', 'customer']);

function normalizeSignupRole(role) {
  const key = String(role || '').trim().toLowerCase().replace(/-/g, '_');
  return ROLE_ALIASES[key] || null;
}

function accountAccessError(userStatus) {
  const normalized = String(userStatus || '').trim().toLowerCase();
  if (normalized === 'active') return null;
  return (
    ACCOUNT_STATUS_MESSAGES[normalized] ||
    'Your account is not active. Please contact the farm administrator for assistance.'
  );
}


export async function register(req, res) {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedRole = normalizeSignupRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: `Unsupported user role: ${role}` });
    }
    if (!SELF_REGISTERABLE_ROLES.has(normalizedRole)) {
      return res.status(403).json({
        error: 'This role cannot be selected during sign-up. Please contact the farm administrator.',
      });
    }
    // Ensure the users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let result;
    try {
      result = await pool.query(
        'INSERT INTO app_users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, role',
        [name, email, phone || null, hashedPassword, normalizedRole]
      );
    } catch (e) {
      // Unique constraint violation (duplicate email)
      if (e.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw e; // rethrow other DB errors
    }
    const user = result.rows[0];
    // New accounts start as 'pending' and must be activated by an administrator,
    // so no session token is issued here.
    res.status(201).json({
      message: 'Account created successfully',
      requiresApproval: true,
      notice:
        'Your account has been created and sent to the administrator for approval. You will be able to sign in once it has been activated.',
      user: { id: user.id, name: user.full_name, email: user.email, phone: user.phone, role: user.role },
    });
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
    const result = await pool.query('SELECT id, full_name, email, phone, password_hash, role, status FROM app_users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const accessError = accountAccessError(user.status);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.full_name, email: user.email, phone: user.phone, role: user.role } });
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

    // Re-read role and status from the database: an account deactivated since the
    // original token was issued must not be able to mint a fresh one.
    const result = await pool.query('SELECT id, role, status FROM app_users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const accessError = accountAccessError(user.status);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    const newToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
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
