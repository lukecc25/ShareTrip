ALTER TABLE passengers
ADD COLUMN IF NOT EXISTS guest_details JSONB NOT NULL DEFAULT '[]'::jsonb;
