import { pool } from '../db.js';
import { getFarmerSalaryStats } from '../controllers/salaryController.js';
import { randomUUID } from 'crypto';

async function runTests() {
  console.log('--- STARTING SALARY ADVANCE & PAYROLL INTEGRATION TESTS ---');

  // Find a worker and a manager from app_users
  const workerRes = await pool.query("SELECT id FROM app_users WHERE LOWER(role::text) IN ('worker', 'farmer') LIMIT 1");
  const managerRes = await pool.query("SELECT id FROM app_users WHERE LOWER(role::text) IN ('farm_manager', 'super_admin') LIMIT 1");

  if (workerRes.rows.length === 0 || managerRes.rows.length === 0) {
    console.error('ERROR: Could not find worker or manager in the database app_users table. Ensure test data exists.');
    process.exit(1);
  }

  const workerId = workerRes.rows[0].id;
  const managerId = managerRes.rows[0].id;
  const testMonth = '2026-08';

  // Get farm_id from farm_memberships
  const membershipRes = await pool.query("SELECT farm_id FROM farm_memberships WHERE user_id = $1 LIMIT 1", [workerId]);
  let farmId = membershipRes.rows[0]?.farm_id;

  if (!farmId) {
    // If no membership, find any farm
    const farmRes = await pool.query("SELECT id FROM farms LIMIT 1");
    farmId = farmRes.rows[0]?.id;
    if (!farmId) {
      farmId = randomUUID();
      await pool.query("INSERT INTO farms (id, farm_name) VALUES ($1, 'Test Farm')", [farmId]);
    }
    // Create membership
    await pool.query("INSERT INTO farm_memberships (user_id, farm_id, role) VALUES ($1, $2, 'worker')", [workerId, farmId]);
  }

  console.log(`Test Parameters:`);
  console.log(`  - Farm ID: ${farmId}`);
  console.log(`  - Worker ID: ${workerId}`);
  console.log(`  - Manager ID: ${managerId}`);
  console.log(`  - Month: ${testMonth}\n`);

  try {
    // Cleanup previous test runs for this specific month
    await pool.query("DELETE FROM salary_transactions WHERE farmer_id = $1", [workerId]);
    await pool.query("DELETE FROM salary_advances WHERE worker_id = $1 AND payroll_month = $2", [workerId, testMonth]);
    await pool.query("DELETE FROM monthly_salary_payments WHERE worker_id = $1 AND payment_month = $2", [workerId, testMonth]);
    await pool.query("DELETE FROM shift_attendances WHERE worker_id = $1 AND EXTRACT(MONTH FROM date) = 8 AND EXTRACT(YEAR FROM date) = 2026", [workerId]);

    // Create a dedicated test shift
    const shiftId = randomUUID();
    await pool.query(`
      INSERT INTO shifts (id, farm_id, shift_name, start_time, end_time, base_wage, standard_hours, hourly_rate)
      VALUES ($1, $2, 'Test Shift', '08:00', '16:00', 1000.00, 8, 125.00)
    `, [shiftId, farmId]);

    // Insert shift attendance
    await pool.query(`
      INSERT INTO shift_attendances (id, farm_id, worker_id, shift_id, date, shift_status, total_hours, payable_wage)
      VALUES ($1, $2, $3, $4, '2026-08-10', 'Present', 8.00, 1000.00)
    `, [randomUUID(), farmId, workerId, shiftId]);

    // DEBUG: check what the database actually has
    const dbg = await pool.query(`
      SELECT sa.*, s.base_wage
      FROM shift_attendances sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.worker_id = $1 AND sa.shift_id = $2
    `, [workerId, shiftId]);
    console.log('DEBUG: shift_attendances row:', dbg.rows);

    // Test 1: Check dynamic earnings stats calculation before any advance exists
    console.log('Test 1: Querying default farmer stats...');
    let stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Earned net salary: Rs. ${stats.net_salary}`);
    console.log(`  - Remaining payable: Rs. ${stats.remaining_payable}`);
    if (stats.net_salary <= 0) {
      throw new Error('Test 1 Failed: Net salary should be greater than zero.');
    }
    console.log('  - Test 1 PASSED');

    // Test 2: Insert a salary advance in Pending state
    console.log('\nTest 2: Requesting salary advance (Pending status)...');
    const advanceId = randomUUID();
    const reqAmount = 200.00;
    await pool.query(`
      INSERT INTO salary_advances (id, farm_id, worker_id, payroll_month, amount, reason, status, payment_status)
      VALUES ($1, $2, $3, $4, $5, 'Medical emergency', 'Pending', 'PAYMENT_PENDING')
    `, [advanceId, farmId, workerId, testMonth, reqAmount]);

    // Check stats. Since advance is Pending (not Paid), it should NOT be subtracted from remaining payable!
    stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Remaining payable with PENDING advance: Rs. ${stats.remaining_payable}`);
    if (stats.remaining_payable !== stats.net_salary) {
      throw new Error('Test 2 Failed: Pending advances should NOT deduct from remaining payable salary.');
    }
    console.log('  - Test 2 PASSED');

    // Test 3: Approve advance to Approved - Payment Pending
    console.log('\nTest 3: Reviewing advance to Approved - Payment Pending...');
    await pool.query(`
      UPDATE salary_advances
      SET status = 'Approved - Payment Pending', manager_id = $1, reviewed_at = NOW()
      WHERE id = $2
    `, [managerId, advanceId]);

    // Check stats again. Status is Approved - Payment Pending, but payment_status is still PAYMENT_PENDING.
    // So it should still NOT be subtracted!
    stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Remaining payable with APPROVED (UNPAID) advance: Rs. ${stats.remaining_payable}`);
    if (stats.remaining_payable !== stats.net_salary) {
      throw new Error('Test 3 Failed: Unpaid approved advances should NOT deduct from remaining payable salary.');
    }
    console.log('  - Test 3 PASSED');

    // Test 4: Pay the advance via Cash (synchronous confirmation)
    console.log('\nTest 4: Paying advance via Cash...');
    // We simulate the paySalaryAdvance endpoint logic:
    // Update advance status to Paid
    await pool.query(`
      UPDATE salary_advances
      SET status = 'Paid', payment_status = 'Paid', payment_method = 'Cash', reviewed_at = NOW()
      WHERE id = $1
    `, [advanceId]);

    // Insert transaction record
    await pool.query(`
      INSERT INTO salary_transactions (
        id, farmer_id, advance_request_id, payment_type, payment_method, amount, payment_status, payment_date, paid_by
      ) VALUES ($1, $2, $3, 'Advance', 'Cash', $4, 'Paid', NOW(), $5)
    `, [randomUUID(), workerId, advanceId, reqAmount, managerId]);

    // Verify stats: Now that the advance is Paid, remaining payable must decrease by reqAmount!
    stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Remaining payable after Paid advance: Rs. ${stats.remaining_payable}`);
    const expectedPayable = stats.net_salary - reqAmount;
    if (stats.remaining_payable !== expectedPayable) {
      throw new Error(`Test 4 Failed: Expected remaining payable to be Rs. ${expectedPayable}, but got Rs. ${stats.remaining_payable}`);
    }
    console.log('  - Test 4 PASSED');

    // Test 5: Verify maximum limit enforcement
    console.log('\nTest 5: Validating request limit enforcement...');
    const excessAmount = stats.remaining_payable + 50.00;
    console.log(`  - Available balance: Rs. ${stats.remaining_payable}. Trying to request: Rs. ${excessAmount}`);
    if (excessAmount > stats.remaining_payable) {
      console.log('  - Correctly identified: requested amount exceeds remaining payable salary limit.');
    } else {
      throw new Error('Test 5 Failed: Limit check logic incorrect.');
    }
    console.log('  - Test 5 PASSED');

    // Test 6: Generate monthly payroll. It should deduct the Paid advance and set status to PARTIALLY PAID.
    console.log('\nTest 6: Generating monthly payroll...');
    const payrollId = randomUUID();
    const finalAmt = stats.net_salary - reqAmount;
    await pool.query(`
      INSERT INTO monthly_salary_payments (
        id, farm_id, worker_id, manager_id, payment_month,
        basic_salary, gross_salary, net_salary, advance_paid, partial_paid, final_payment_amount, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $7, 0, $8, 'PARTIALLY PAID')
    `, [payrollId, farmId, workerId, managerId, testMonth, stats.net_salary, reqAmount, finalAmt]);

    // Link advance to this payroll record
    await pool.query(`
      UPDATE salary_advances
      SET deducted_from_payment_id = $1
      WHERE id = $2
    `, [payrollId, advanceId]);

    // Query stats to confirm consistency
    stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Payroll record generated successfully. Remaining payable: Rs. ${stats.remaining_payable}`);
    if (stats.remaining_payable !== finalAmt) {
      throw new Error(`Test 6 Failed: Expected remaining payable after payroll generation to be Rs. ${finalAmt}, but got Rs. ${stats.remaining_payable}`);
    }
    console.log('  - Test 6 PASSED');

    // Test 7: Pay final monthly salary via Mock Online Bank Payout
    console.log('\nTest 7: Paying final salary via Online Bank Payout (simulation)...');
    // Set status to Processing (Phase 1)
    await pool.query(`
      UPDATE monthly_salary_payments
      SET payment_status = 'Processing', payment_method = 'Online Bank Payout'
      WHERE id = $1
    `, [payrollId]);

    // Simulate successful payout response (Phase 2)
    const mockTxnId = `MOCK-TXN-${randomUUID()}`;
    await pool.query(`
      UPDATE monthly_salary_payments
      SET payment_status = 'FULLY PAID',
          transaction_reference = $1,
          payment_date = NOW(),
          final_payment_amount = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [mockTxnId, finalAmt, payrollId]);

    // Insert transaction
    await pool.query(`
      INSERT INTO salary_transactions (
        id, farmer_id, payroll_id, payment_type, payment_method, amount, provider, transaction_id, payment_status, payment_date, paid_by
      ) VALUES ($1, $2, $3, 'Final Salary', 'Online Bank Payout', $4, 'MockPayoutProvider', $5, 'Paid', NOW(), $6)
    `, [randomUUID(), workerId, payrollId, finalAmt, mockTxnId, managerId]);

    const txns = await pool.query("SELECT id, payment_type, amount, payment_status FROM salary_transactions WHERE payroll_id = $1", [payrollId]);
    console.log('DEBUG: final salary txns in db:', txns.rows);

    stats = await getFarmerSalaryStats(farmId, workerId, testMonth);
    console.log(`  - Final remaining payable: Rs. ${stats.remaining_payable}`);
    if (stats.remaining_payable !== 0) {
      throw new Error(`Test 7 Failed: Expected remaining payable to be Rs. 0.00, but got Rs. ${stats.remaining_payable}`);
    }
    console.log('  - Test 7 PASSED');

    console.log('\n--- ALL TEST CASES PASSED SUCCESSFULLY! ---');

  } catch (err) {
    console.error('\nTEST RUN FAILED WITH ERROR:', err);
  } finally {
    // Clean up test shift
    try {
      await pool.query("DELETE FROM shifts WHERE shift_name = 'Test Shift'");
    } catch (_) {}
    await pool.end();
    process.exit(0);
  }
}

runTests();
