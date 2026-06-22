import { pool } from '../db.js';

async function ensureContactMessagesTable() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS contact_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name text NOT NULL,
      email text NOT NULL,
      phone text,
      subject text NOT NULL,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
    CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
    CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
  `);
}

export async function submitContactMessage(req, res) {
  try {
    const { full_name, email, phone, subject, message } = req.body;

    if (!full_name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Full name, email, subject, and message are required.' });
    }

    await ensureContactMessagesTable();

    const result = await pool.query(
      `INSERT INTO contact_messages (full_name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, phone, subject, message, status, created_at`,
      [full_name.trim(), email.trim().toLowerCase(), phone?.trim() || null, subject.trim(), message.trim()]
    );

    res.status(201).json({
      message: 'Contact message submitted successfully.',
      contactMessage: result.rows[0],
    });
  } catch (err) {
    console.error('Contact message submission error:', err);
    res.status(500).json({ error: 'Failed to submit contact message.' });
  }
}
