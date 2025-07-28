-- Add preference columns to visitor_signups table
ALTER TABLE public.visitor_signups 
ADD COLUMN preferred_categories text[],
ADD COLUMN other_category text,
ADD COLUMN preferred_countries text[],
ADD COLUMN preferred_media_types text[],
ADD COLUMN preferred_news_sources text[];