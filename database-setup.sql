-- Create the audits table if it doesn't exist
CREATE TABLE IF NOT EXISTS audits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  video_url text NOT NULL,
  video_title text,
  ai_titles text[],
  ai_description text,
  ai_tags text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS audits_user_id_idx ON audits(user_id);

-- Create an index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS audits_created_at_idx ON audits(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (you can make this more restrictive later)
CREATE POLICY "Allow all operations on audits" ON audits
FOR ALL USING (true) WITH CHECK (true);