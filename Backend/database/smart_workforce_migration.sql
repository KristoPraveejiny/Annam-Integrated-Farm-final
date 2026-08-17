-- Add new values to task_status
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'work_pending_confirmation';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'evidence_uploaded';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'waiting_manager_approval';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'rework_requested';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'missed_shift';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'late_submission';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add new values to attendance_status
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'late_present';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'leave';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'holiday';

-- Add new columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS shift_start_time timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS shift_end_time timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS grace_period_hours integer DEFAULT 12;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_review_notes text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_reviewed_at timestamptz;

-- Create task_evidences table
CREATE TABLE IF NOT EXISTS task_evidences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    notes text,
    images jsonb,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Create task_timeline table
CREATE TABLE IF NOT EXISTS task_timeline (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    action text NOT NULL,
    previous_status text,
    new_status text,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create farm_shift_settings table
CREATE TABLE IF NOT EXISTS farm_shift_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    morning_start time,
    morning_end time,
    afternoon_start time,
    afternoon_end time,
    evening_start time,
    evening_end time,
    grace_period_hours integer DEFAULT 12,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT farm_shift_settings_unique UNIQUE (farm_id)
);
