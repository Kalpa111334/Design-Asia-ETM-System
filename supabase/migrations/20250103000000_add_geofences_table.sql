-- Add geofences table for location management
CREATE TABLE IF NOT EXISTS public.geofences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    center_latitude DOUBLE PRECISION NOT NULL,
    center_longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- Enable RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage geofences"
    ON public.geofences FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can view active geofences"
    ON public.geofences FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Temporary policy to allow all authenticated users to insert geofences (for testing)
CREATE POLICY "Allow authenticated users to insert geofences"
    ON public.geofences FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_geofences_created_by ON public.geofences(created_by);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_geofences_updated_at 
    BEFORE UPDATE ON public.geofences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
