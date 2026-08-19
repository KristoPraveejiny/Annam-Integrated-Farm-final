import { pool } from '../db.js';
import { sendContactReplyEmail } from '../services/emailService.js';

const VALID_STATUSES = ['new', 'contacted', 'resolved', 'closed'];

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

    CREATE TABLE IF NOT EXISTS contact_replies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_message_id uuid NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
      replied_by_user_id uuid,
      reply_message text NOT NULL,
      email_sent boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_contact_replies_message ON contact_replies(contact_message_id);
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

export async function getContactMessages(req, res) {
  try {
    await ensureContactMessagesTable();

    const { status, search } = req.query;
    const params = [];
    const filters = [];

    if (status && status !== 'all' && VALID_STATUSES.includes(String(status).toLowerCase())) {
      params.push(String(status).toLowerCase());
      filters.push(`cm.status = $${params.length}`);
    }

    if (search && String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      filters.push(
        `(cm.full_name ILIKE $${params.length} OR cm.email ILIKE $${params.length} OR cm.phone ILIKE $${params.length} OR cm.subject ILIKE $${params.length})`
      );
    }

    const messagesRes = await pool.query(
      `
        SELECT
          cm.id, cm.full_name, cm.email, cm.phone, cm.subject, cm.message,
          cm.status, cm.created_at, cm.updated_at,
          COALESCE(r.reply_count, 0) AS reply_count,
          r.last_replied_at
        FROM contact_messages cm
        LEFT JOIN (
          SELECT contact_message_id, COUNT(*) AS reply_count, MAX(created_at) AS last_replied_at
          FROM contact_replies
          GROUP BY contact_message_id
        ) r ON r.contact_message_id = cm.id
        ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY cm.created_at DESC
      `,
      params
    );

    // Counts are always over the whole table so the stat cards/tabs stay stable while filtering.
    const countsRes = await pool.query(`SELECT status, COUNT(*)::int AS count FROM contact_messages GROUP BY status`);
    const counts = { total: 0, new: 0, contacted: 0, resolved: 0, closed: 0 };
    for (const row of countsRes.rows) {
      const key = String(row.status || '').toLowerCase();
      if (key in counts) counts[key] = row.count;
      counts.total += row.count;
    }

    res.json({ messages: messagesRes.rows, counts });
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    res.status(500).json({ error: 'Failed to fetch contact messages.' });
  }
}

export async function getContactMessageById(req, res) {
  try {
    await ensureContactMessagesTable();
    const { id } = req.params;

    const messageRes = await pool.query(`SELECT * FROM contact_messages WHERE id = $1`, [id]);
    if (messageRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    const repliesRes = await pool.query(
      `
        SELECT cr.id, cr.reply_message, cr.email_sent, cr.created_at,
               u.full_name AS replied_by_name
        FROM contact_replies cr
        LEFT JOIN app_users u ON u.id = cr.replied_by_user_id
        WHERE cr.contact_message_id = $1
        ORDER BY cr.created_at ASC
      `,
      [id]
    );

    res.json({ ...messageRes.rows[0], replies: repliesRes.rows });
  } catch (err) {
    console.error('Error fetching contact message:', err);
    res.status(500).json({ error: 'Failed to fetch contact message.' });
  }
}

export async function updateContactMessageStatus(req, res) {
  try {
    await ensureContactMessagesTable();
    const { id } = req.params;
    const status = String(req.body.status || '').toLowerCase();

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE contact_messages SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    res.json({ message: 'Status updated successfully.', contactMessage: result.rows[0] });
  } catch (err) {
    console.error('Error updating contact message status:', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}

export async function replyToContactMessage(req, res) {
  try {
    await ensureContactMessagesTable();
    const { id } = req.params;
    const replyMessage = String(req.body.replyMessage || '').trim();

    if (!replyMessage) {
      return res.status(400).json({ error: 'Reply message is required.' });
    }

    const messageRes = await pool.query(`SELECT * FROM contact_messages WHERE id = $1`, [id]);
    if (messageRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }
    const contactMessage = messageRes.rows[0];

    const emailSent = await sendContactReplyEmail(contactMessage.email, {
      recipientName: contactMessage.full_name,
      originalSubject: contactMessage.subject,
      originalMessage: contactMessage.message,
      originalSentAt: contactMessage.created_at,
      replyMessage,
    });

    const replyRes = await pool.query(
      `INSERT INTO contact_replies (contact_message_id, replied_by_user_id, reply_message, email_sent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reply_message, email_sent, created_at`,
      [id, req.user?.userId || null, replyMessage, emailSent]
    );

    // Once we've responded, a still-"new" enquiry has now been contacted.
    let updated = contactMessage;
    if (String(contactMessage.status).toLowerCase() === 'new') {
      const statusRes = await pool.query(
        `UPDATE contact_messages SET status = 'contacted', updated_at = now() WHERE id = $1 RETURNING *`,
        [id]
      );
      updated = statusRes.rows[0];
    }

    if (!emailSent) {
      return res.status(502).json({
        error: `Reply was saved, but the email could not be delivered to ${contactMessage.email}. Please check the mail server settings.`,
        reply: replyRes.rows[0],
        contactMessage: updated,
      });
    }

    res.json({
      message: `Reply sent to ${contactMessage.email}.`,
      reply: replyRes.rows[0],
      contactMessage: updated,
    });
  } catch (err) {
    console.error('Error replying to contact message:', err);
    res.status(500).json({ error: 'Failed to send reply.' });
  }
}

export async function deleteContactMessage(req, res) {
  try {
    await ensureContactMessagesTable();
    const { id } = req.params;

    const result = await pool.query(`DELETE FROM contact_messages WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    res.json({ message: 'Contact message deleted successfully.' });
  } catch (err) {
    console.error('Error deleting contact message:', err);
    res.status(500).json({ error: 'Failed to delete contact message.' });
  }
}
