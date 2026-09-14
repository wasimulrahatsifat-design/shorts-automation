-- Create an enum for the status
CREATE TYPE shorts_status AS ENUM ('Pending', 'Needs_Approval', 'Scheduled', 'Published');

-- Create the shorts_queue table
CREATE TABLE IF NOT EXISTS shorts_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    data_json JSONB NOT NULL,
    video_url TEXT,
    status shorts_status NOT NULL DEFAULT 'Pending',
    scheduled_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
