// The checkout flow records who transferred the money and from which bank, and
// the order-listing queries in marketplaceController.js read those fields back.
// The columns were never added, so every checkout that includes an advance
// payment failed with 'column "payment_method" does not exist'.
import { pool } from '../db.js';

async function run() {
  await pool.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS sender_name TEXT,
      ADD COLUMN IF NOT EXISTS sender_bank_name TEXT,
      ADD COLUMN IF NOT EXISTS sender_account_number TEXT,
      ADD COLUMN IF NOT EXISTS sender_phone TEXT,
      ADD COLUMN IF NOT EXISTS sender_note TEXT
  `);

  // Existing rows kept their details only inside raw_payload; lift them into
  // the new columns so old orders read the same as new ones.
  await pool.query(`
    UPDATE payments
    SET payment_method        = COALESCE(payment_method, raw_payload->>'paymentMethod'),
        sender_name           = COALESCE(sender_name, raw_payload->'senderDetails'->>'senderName'),
        sender_bank_name      = COALESCE(sender_bank_name, raw_payload->'senderDetails'->>'senderBankName'),
        sender_account_number = COALESCE(sender_account_number, raw_payload->'senderDetails'->>'senderAccountNumber'),
        sender_phone          = COALESCE(sender_phone, raw_payload->'senderDetails'->>'senderPhone'),
        sender_note           = COALESCE(sender_note, raw_payload->'senderDetails'->>'senderNote')
    WHERE raw_payload IS NOT NULL
  `);

  const check = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'payments'
      AND column_name IN ('payment_method','sender_name','sender_bank_name','sender_account_number','sender_phone','sender_note')
    ORDER BY column_name
  `);
  console.log('payments now has:', check.rows.map((row) => row.column_name).join(', '));

  const backfilled = await pool.query('SELECT COUNT(*)::int AS c FROM payments WHERE payment_method IS NOT NULL');
  console.log('rows with a payment method:', backfilled.rows[0].c);

  await pool.end();
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
