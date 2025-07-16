-- Create visitor_signups table for capturing visitor details
CREATE TABLE public.visitor_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  year_of_birth INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.visitor_signups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for public signup)
CREATE POLICY "Anyone can insert visitor signups" 
ON public.visitor_signups 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow only authenticated users to view (for admin access)
CREATE POLICY "Only authenticated users can view visitor signups" 
ON public.visitor_signups 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_visitor_signups_updated_at
  BEFORE UPDATE ON public.visitor_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add constraint for reasonable year of birth range
ALTER TABLE public.visitor_signups 
ADD CONSTRAINT check_year_of_birth 
CHECK (year_of_birth >= 1920 AND year_of_birth <= 2010);