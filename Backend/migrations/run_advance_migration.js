import { pool } from '../db.js';

export async function up() {
  console.log('Running advance payment and salary transactions migrations...');
  
  // 1. Create salary_transactions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      farmer_id uuid NOT NULL REFERENCES app_users(id),
      payroll_id uuid NULL REFERENCES monthly_salary_payments(id),
      advance_request_id uuid NULL,
      payment_type varchar(50) NOT NULL, -- 'Advance', 'Partial Salary', 'Final Salary'
      payment_method varchar(50) NOT NULL, -- 'Cash', 'Bank Transfer', 'Online Bank Payout'
      amount numeric(12,2) NOT NULL DEFAULT 0.00,
      currency varchar(10) NOT NULL DEFAULT 'INR',
      provider varchar(100) NULL,
      transaction_id varchar(255) NULL,
      payment_status varchar(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed', 'Payment Pending Confirmation'
      payment_date timestamptz NULL,
      paid_by uuid NULL REFERENCES app_users(id),
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  // 2. Add columns to monthly_salary_payments
  const monthlyCols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'monthly_salary_payments' 
      AND column_name IN ('advance_paid', 'partial_paid')
  `);
  const existingMonthlyCols = monthlyCols.rows.map(r => r.column_name);

  if (!existingMonthlyCols.includes('advance_paid')) {
    await pool.query(`
      ALTER TABLE monthly_salary_payments 
      ADD COLUMN advance_paid numeric(12,2) NOT NULL DEFAULT 0.00
    `);
  }
  if (!existingMonthlyCols.includes('partial_paid')) {
    await pool.query(`
      ALTER TABLE monthly_salary_payments 
      ADD COLUMN partial_paid numeric(12,2) NOT NULL DEFAULT 0.00
    `);
  }

  // A payroll summary is not a payment receipt. Keep its date empty until a
  // successful salary transaction records the actual payment time.
  await pool.query(`
    ALTER TABLE monthly_salary_payments
    ALTER COLUMN payment_date DROP DEFAULT
  `);
  await pool.query(`
    UPDATE monthly_salary_payments p
    SET payment_date = NULL
    WHERE LOWER(BTRIM(COALESCE(p.payment_status, ''))) NOT IN ('paid', 'fully paid')
      AND NOT EXISTS (
        SELECT 1
        FROM salary_transactions st
        WHERE st.payroll_id = p.id
          AND LOWER(BTRIM(COALESCE(st.payment_status, ''))) = 'paid'
      )
  `);

  // 3. Add columns to salary_advances
  const advanceCols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'salary_advances' 
      AND column_name IN ('payment_status', 'transaction_id', 'bank_reference', 'provider', 'payment_date')
  `);
  const existingAdvanceCols = advanceCols.rows.map(r => r.column_name);

  if (!existingAdvanceCols.includes('payment_status')) {
    await pool.query(`
      ALTER TABLE salary_advances 
      ADD COLUMN payment_status varchar(50) NOT NULL DEFAULT 'Pending'
    `);
  }
  if (!existingAdvanceCols.includes('transaction_id')) {
    await pool.query(`
      ALTER TABLE salary_advances 
      ADD COLUMN transaction_id varchar(255) NULL
    `);
  }
  if (!existingAdvanceCols.includes('bank_reference')) {
    await pool.query(`
      ALTER TABLE salary_advances 
      ADD COLUMN bank_reference text NULL
    `);
  }
  if (!existingAdvanceCols.includes('provider')) {
    await pool.query(`
      ALTER TABLE salary_advances 
      ADD COLUMN provider text NULL
    `);
  }
  if (!existingAdvanceCols.includes('payment_date')) {
    // Note: keeping it text as currently found in DB
    await pool.query(`
      ALTER TABLE salary_advances 
      ADD COLUMN payment_date text NULL
    `);
  }

  console.log('Advance payment and salary transactions migrations completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('run_advance_migration.js')) {
  up().then(() => process.exit(0)).catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
}
