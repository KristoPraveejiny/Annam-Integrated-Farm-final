function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShiftName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function dateKey(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const asString = String(value).trim();
  return asString ? asString.slice(0, 10) : null;
}

// A payroll row is a snapshot taken when it was generated; tasks approved afterwards
// only exist in salary_ledger. These helpers restate an unsettled row from the ledger so
// the manager, admin and worker views can never drift apart.
const SETTLED_PAYMENT_STATUSES = ['paid', 'fully paid'];

export function isSettledPayroll(row) {
  return SETTLED_PAYMENT_STATUSES.includes(String(row?.payment_status || '').trim().toLowerCase());
}

// salary_ledger already holds the approved task earnings, so it replaces the shift wage
// rather than adding to it. Advances and partial payments count as deductions.
export function summarisePayrollRow(row, ledgerEarnings = 0) {
  const ledger = toNumber(ledgerEarnings);
  const storedEarned = toNumber(row?.base_salary) || toNumber(row?.basic_salary) || toNumber(row?.gross_salary);
  const earned = ledger > 0 ? ledger : storedEarned;

  const bonus = toNumber(row?.bonus);
  const paidOut = toNumber(row?.advance_paid) + toNumber(row?.partial_paid);
  const deductions = toNumber(row?.deductions) + paidOut;
  const remaining = Math.max(0, earned + bonus - deductions);

  return {
    earned: Number(earned.toFixed(2)),
    bonus: Number(bonus.toFixed(2)),
    paid_out: Number(paidOut.toFixed(2)),
    deductions_total: Number(deductions.toFixed(2)),
    remaining: Number(remaining.toFixed(2)),
  };
}

export function daysInMonth(month, year) {
  const monthIndex = Math.max(1, Number(month) || 1);
  const yearValue = Number(year) || new Date().getFullYear();
  return new Date(yearValue, monthIndex, 0).getDate();
}

export function calculatePayrollMetrics(rows = [], { month, year, bonus = 0, deductions = 0 } = {}) {
  const dayMap = new Map();
  let completedShifts = 0;
  let morningShifts = 0;
  let afternoonShifts = 0;
  let eveningShifts = 0;
  let shiftWageEarned = 0;
  let overtimePay = 0;
  let totalWorkingHours = 0;

  for (const row of rows) {
    const isAbsent = String(row.shift_status || row.attendance_status || row.status || '').toLowerCase() === 'absent';

    if (!isAbsent) {
      completedShifts += 1;
      totalWorkingHours += toNumber(row.total_hours);

      const shiftName = normalizeShiftName(row.shift_name || row.session);
      if (shiftName === 'morning') morningShifts += 1;
      if (shiftName === 'afternoon') afternoonShifts += 1;
      if (shiftName === 'evening') eveningShifts += 1;
    }

    const rawPayable = toNumber(row.payable_wage);
    const rawBase = toNumber(row.base_wage ?? row.shift_wage_earned);
    const baseWage = isAbsent ? 0 : (rawPayable > 0 ? rawPayable : rawBase);
    
    const standardHours = toNumber(row.standard_hours);
    const derivedHourlyRate = toNumber(
      row.derived_hourly_rate
      ?? (standardHours > 0 ? (rawBase / standardHours) : row.hourly_rate)
    );
    const overtimeRate = row.overtime_rate !== undefined && row.overtime_rate !== null ? toNumber(row.overtime_rate) : derivedHourlyRate;
    const overtimeHours = Math.max(toNumber(row.total_hours) - standardHours, 0);
    const rowOvertimePay = isAbsent ? 0 : (row.overtime_pay !== undefined && row.overtime_pay !== null ? toNumber(row.overtime_pay) : (overtimeHours > 0 ? overtimeHours * overtimeRate : 0));

    shiftWageEarned += baseWage;
    overtimePay += rowOvertimePay;

    if (!isAbsent) {
      const key = dateKey(row.date);
      if (key) {
        const existing = dayMap.get(key) || 0;
        dayMap.set(key, existing + 1);
      }
    }
  }

  const equivalentPresentDays = Number((completedShifts / 3).toFixed(2));
  const totalPossibleShifts = daysInMonth(month, year) * 3;
  const attendancePercentage = totalPossibleShifts > 0
    ? Number(((completedShifts / totalPossibleShifts) * 100).toFixed(2))
    : 0;

  const attendanceStatus = completedShifts === 0
    ? 'Absent'
    : equivalentPresentDays >= 1
      ? 'Present'
      : 'Half Day';

  const activeDays = dayMap.size;
  const halfDays = Array.from(dayMap.values()).filter((count) => count > 0 && count < 3).length;
  const fullDays = Array.from(dayMap.values()).filter((count) => count >= 3).length;

  const grossSalary = Number((shiftWageEarned + overtimePay + toNumber(bonus) - toNumber(deductions)).toFixed(2));
  const netSalary = grossSalary;

  return {
    completedShifts,
    activeDays,
    fullDays,
    halfDays,
    morningShifts,
    afternoonShifts,
    eveningShifts,
    totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
    shiftWageEarned: Number(shiftWageEarned.toFixed(2)),
    overtimePay: Number(overtimePay.toFixed(2)),
    bonus: Number(toNumber(bonus).toFixed(2)),
    deductions: Number(toNumber(deductions).toFixed(2)),
    grossSalary,
    netSalary,
    equivalentPresentDays,
    attendancePercentage,
    attendanceStatus,
    presentDays: equivalentPresentDays,
  };
}
