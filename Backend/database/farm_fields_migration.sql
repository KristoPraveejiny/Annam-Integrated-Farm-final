-- Add field_id to crop_cycles
ALTER TABLE crop_cycles ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL;

-- Add field_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL;
