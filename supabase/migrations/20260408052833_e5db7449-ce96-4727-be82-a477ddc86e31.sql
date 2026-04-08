
-- Create professional_office_locations table
CREATE TABLE public.professional_office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_public_profile_id uuid NOT NULL REFERENCES public.professional_public_profiles(id) ON DELETE CASCADE,
  label text DEFAULT 'Consultório principal',
  address_line text NOT NULL,
  number text DEFAULT '',
  complement text DEFAULT '',
  neighborhood text DEFAULT '',
  city text NOT NULL,
  state text NOT NULL,
  postal_code text DEFAULT '',
  country text DEFAULT 'BR',
  formatted_address text DEFAULT '',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  mapbox_place_id text DEFAULT '',
  is_primary boolean DEFAULT true,
  is_public boolean DEFAULT true,
  geocoded_at timestamptz,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_office_loc_profile_primary ON public.professional_office_locations (professional_public_profile_id, is_primary);
CREATE INDEX idx_office_loc_city_state ON public.professional_office_locations (city, state);
CREATE INDEX idx_office_loc_coords ON public.professional_office_locations (latitude, longitude);

-- Enable RLS (matching existing pattern)
ALTER TABLE public.professional_office_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access"
ON public.professional_office_locations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Add entity to base44 compatibility layer
-- (handled in code)
