-- Add promotional email preference column to visitor_signups table
ALTER TABLE public.visitor_signups 
ADD COLUMN do_not_contact_for_promotions boolean NOT NULL DEFAULT false;