import { pool } from '../db.js';

async function migrateWorkforce() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating shifts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
        shift_name VARCHAR(255) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        standard_hours NUMERIC(5,2) DEFAULT 0,
        base_wage NUMERIC(10,2) DEFAULT 0,
        hourly_rate NUMERIC(10,2) DEFAULT 0,
        overtime_rate NUMERIC(10,2) DEFAULT 0,
        holiday_rate NUMERIC(10,2) DEFAULT 0,
        weekend_rate NUMERIC(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Updating tasks table...');
    // We need to add columns. Some might already exist, so we catch errors per ALTER.
    const taskColumns = [
      'ADD COLUMN shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL',
      'ADD COLUMN start_time TIMESTAMP WITH TIME ZONE',
      'ADD COLUMN end_time TIMESTAMP WITH TIME ZONE',
      'ADD COLUMN working_hours NUMERIC(5,2)',
      'ALTER COLUMN status TYPE VARCHAR(50)' // Changing from enum to varchar just to be safe, or we can just alter the enum if it's an enum.
    ];
    for (let col of taskColumns) {
      try {
        await client.query(`ALTER TABLE tasks ${col};`);
      } catch (e) {
        console.log(`Note: ${col} - ${e.message}`);
      }
    }

    console.log('Creating shift_attendances table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_attendances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id UUID NOT NULL, -- references app_users/user_profiles
        date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
        check_in_time TIMESTAMP WITH TIME ZONE,
        check_out_time TIMESTAMP WITH TIME ZONE,
        total_hours NUMERIC(5,2) DEFAULT 0,
        shift_status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Updating monthly_salary_payments table...');
    const payrollColumns = [
      'ADD COLUMN present_days INTEGER DEFAULT 0',
      'ADD COLUMN half_days INTEGER DEFAULT 0',
      'ADD COLUMN leaves INTEGER DEFAULT 0',
      'ADD COLUMN morning_shifts INTEGER DEFAULT 0',
      'ADD COLUMN afternoon_shifts INTEGER DEFAULT 0',
      'ADD COLUMN evening_shifts INTEGER DEFAULT 0',
      'ADD COLUMN total_working_hours NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN overtime NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN base_salary NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN hourly_wage_total NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN holiday_wages NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN weekend_wages NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN deductions NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN gross_salary NUMERIC(10,2) DEFAULT 0',
      'ADD COLUMN net_salary NUMERIC(10,2) DEFAULT 0'
    ];
    for (let col of payrollColumns) {
      try {
        await client.query(`ALTER TABLE monthly_salary_payments ${col};`);
      } catch (e) {
        console.log(`Note: ${col} - ${e.message}`);
      }
    }

    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR(100),
        priority VARCHAR(50) DEFAULT 'Low',
        delivery_channel JSONB DEFAULT '[]'::jsonb,
        read_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating audit_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        user_role VARCHAR(100),
        module VARCHAR(100) NOT NULL,
        action VARCHAR(255) NOT NULL,
        record_id UUID,
        previous_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Adding default shifts to existing farms...');
    // Only if farms exist and shifts for them don't exist yet
    await client.query(`
      INSERT INTO shifts (farm_id, shift_name, start_time, end_time, standard_hours, base_wage, hourly_rate)
      SELECT f.id, 'Morning', '06:00:00', '11:00:00', 5.0, 1200.00, 240.00
      FROM farms f
      WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.farm_id = f.id AND s.shift_name = 'Morning');

      INSERT INTO shifts (farm_id, shift_name, start_time, end_time, standard_hours, base_wage, hourly_rate)
      SELECT f.id, 'Afternoon', '12:00:00', '16:00:00', 4.0, 1000.00, 250.00
      FROM farms f
      WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.farm_id = f.id AND s.shift_name = 'Afternoon');

      INSERT INTO shifts (farm_id, shift_name, start_time, end_time, standard_hours, base_wage, hourly_rate)
      SELECT f.id, 'Evening', '16:00:00', '20:00:00', 4.0, 1300.00, 325.00
      FROM farms f
      WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.farm_id = f.id AND s.shift_name = 'Evening');
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrateWorkforce();
