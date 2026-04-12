-- Home hero banners served only through Edge Functions.

CREATE TABLE IF NOT EXISTS public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  desktop_only boolean NOT NULL DEFAULT true,
  focal_x numeric(5,4),
  focal_y numeric(5,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_banners_storage_path_not_empty CHECK (btrim(storage_path) <> ''),
  CONSTRAINT home_banners_focal_x_range CHECK (focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1)),
  CONSTRAINT home_banners_focal_y_range CHECK (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1))
);

CREATE INDEX IF NOT EXISTS idx_home_banners_active_sort
  ON public.home_banners (is_active, desktop_only, sort_order, created_at DESC);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_home_banners_updated_at ON public.home_banners;

CREATE TRIGGER set_home_banners_updated_at
BEFORE UPDATE ON public.home_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'home-banners',
  'home-banners',
  false,
  3145728,
  ARRAY['image/jpeg', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
