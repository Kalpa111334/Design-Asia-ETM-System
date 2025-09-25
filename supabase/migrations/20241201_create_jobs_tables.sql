-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20),
  sales_person VARCHAR(255),
  start_date DATE NOT NULL,
  completion_date DATE NOT NULL,
  contractor_name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_materials table
CREATE TABLE IF NOT EXISTS job_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add job_id column to tasks table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_name ON jobs(customer_name);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_job_materials_job_id ON job_materials(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);

-- Enable RLS (Row Level Security)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_materials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for jobs table
CREATE POLICY "Users can view all jobs" ON jobs
  FOR SELECT USING (true);

CREATE POLICY "Users can create jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update jobs" ON jobs
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete jobs" ON jobs
  FOR DELETE USING (true);

-- Create RLS policies for job_materials table
CREATE POLICY "Users can view job materials" ON job_materials
  FOR SELECT USING (true);

CREATE POLICY "Users can create job materials" ON job_materials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update job materials" ON job_materials
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete job materials" ON job_materials
  FOR DELETE USING (true);

-- Create function to automatically generate job numbers
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get the next number by finding the highest existing number
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM jobs
  WHERE job_number ~ '^JOB-[0-9]+$';
  
  -- Set the job number
  NEW.job_number := 'JOB-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate job numbers
CREATE TRIGGER trigger_generate_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.job_number IS NULL OR NEW.job_number = '')
  EXECUTE FUNCTION generate_job_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at timestamp
CREATE TRIGGER trigger_update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_job_materials_updated_at
  BEFORE UPDATE ON job_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample jobs for testing
INSERT INTO jobs (customer_name, contact_number, sales_person, start_date, completion_date, contractor_name, description, created_by)
VALUES 
  ('ABC Construction Ltd', '+94771234567', 'John Smith', '2024-01-15', '2024-03-15', 'Contractor A', 'Building construction project', auth.uid()),
  ('XYZ Industries', '+94779876543', 'Jane Doe', '2024-02-01', '2024-04-01', 'Contractor B', 'Factory renovation', auth.uid()),
  ('DEF Corporation', '+94775551234', 'Bob Johnson', '2024-01-20', '2024-02-20', 'Contractor C', 'Office setup', auth.uid())
ON CONFLICT DO NOTHING;

-- Insert sample materials for the first job
INSERT INTO job_materials (job_id, name, date, description, quantity, rate, amount)
SELECT 
  j.id,
  'Cement',
  '2024-01-15',
  'High quality cement for foundation',
  100.00,
  1500.00,
  150000.00
FROM jobs j 
WHERE j.job_number = 'JOB-001'
ON CONFLICT DO NOTHING;

INSERT INTO job_materials (job_id, name, date, description, quantity, rate, amount)
SELECT 
  j.id,
  'Steel Rods',
  '2024-01-16',
  'Reinforcement steel rods',
  50.00,
  2500.00,
  125000.00
FROM jobs j 
WHERE j.job_number = 'JOB-001'
ON CONFLICT DO NOTHING;
