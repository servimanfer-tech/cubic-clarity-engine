ALTER TABLE public.page_visits ADD COLUMN IF NOT EXISTS visitor_id text;
CREATE INDEX IF NOT EXISTS idx_page_visits_visitor_id ON public.page_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits(created_at DESC);