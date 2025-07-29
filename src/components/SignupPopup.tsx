import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  email: z.string().email('Please enter a valid email address'),
  yearOfBirth: z
    .number()
    .min(1920, 'Year must be between 1920 and 2010')
    .max(2010, 'Year must be between 1920 and 2010'),
  preferredCategories: z.array(z.string()).min(1, 'Please select at least one category'),
  otherCategory: z.string().optional(),
  preferredCountries: z.array(z.string()).min(1, 'Please select at least one country'),
  preferredMediaTypes: z.array(z.string()).min(1, 'Please select at least one media type'),
  preferredNewsSources: z.array(z.string()).min(1, 'Please select at least one news source'),
}).refine((data) => {
  if (data.preferredCategories.includes('other') && !data.otherCategory?.trim()) {
    return false;
  }
  return true;
}, {
  message: 'Please specify your other category interest',
  path: ['otherCategory'],
});

type FormData = z.infer<typeof formSchema>;

export function SignupPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      email: '',
      yearOfBirth: undefined,
      preferredCategories: [],
      otherCategory: '',
      preferredCountries: [],
      preferredMediaTypes: [],
      preferredNewsSources: [],
    },
  });

  useEffect(() => {
    // Check if user has already signed up or dismissed popup
    const hasSignedUp = localStorage.getItem('visitor_signed_up');
    const hasDismissed = localStorage.getItem('popup_dismissed');
    
    if (hasSignedUp || hasDismissed) {
      return;
    }

    // Show popup after 5 seconds
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('visitor_signups')
        .insert({
          first_name: data.firstName,
          email: data.email,
          year_of_birth: data.yearOfBirth,
          preferred_categories: data.preferredCategories,
          other_category: data.otherCategory || null,
          preferred_countries: data.preferredCountries,
          preferred_media_types: data.preferredMediaTypes,
          preferred_news_sources: data.preferredNewsSources,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Email already registered',
            description: 'This email is already signed up for updates.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        // Success
        localStorage.setItem('visitor_signed_up', 'true');
        setIsOpen(false);
        toast({
          title: 'Successfully signed up!',
          description: 'Thank you for signing up. You\'ll receive updates on new features and exclusive discounts.',
        });
      }
    } catch (error) {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
      console.error('Signup error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('popup_dismissed', 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl backdrop-blur-sm bg-gradient-to-br from-background via-background to-blue-accent/5 rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-accent via-accent to-blue-accent rounded-t-2xl"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-transparent to-blue-accent/3 rounded-2xl pointer-events-none"></div>
        <DialogHeader className="pt-6 pb-2 relative z-10">
          <DialogTitle className="flex items-center justify-between text-xl font-semibold">
            <span className="bg-gradient-to-r from-blue-accent via-accent to-blue-accent bg-clip-text text-transparent">
              Join Our Community
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 hover:bg-blue-accent/10 rounded-full transition-all duration-200 hover:scale-110"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-blue-accent" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <p className="text-base text-foreground font-medium">
              Get exclusive updates & early access
            </p>
            <p className="text-sm text-muted-foreground">
              Be the first to know about new features, exclusive discounts, and premium content.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">First Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your first name" 
                        className="border-2 border-muted focus:border-blue-accent rounded-lg transition-all duration-200 bg-background/50 backdrop-blur-sm" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email address"
                        className="border-2 border-muted focus:border-blue-accent rounded-lg transition-all duration-200 bg-background/50 backdrop-blur-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yearOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">Year of Birth</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 1990"
                        className="border-2 border-muted focus:border-blue-accent rounded-lg transition-all duration-200 bg-background/50 backdrop-blur-sm"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredCategories"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">Content Preferences</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {['business', 'sport', 'politics', 'technology', 'entertainment', 'other'].map((category) => (
                        <FormField
                          key={category}
                          control={form.control}
                          name="preferredCategories"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 rounded-lg border-2 border-muted hover:border-blue-accent/30 transition-all duration-200 bg-background/30 backdrop-blur-sm">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    className="border-2 border-blue-accent data-[state=checked]:bg-blue-accent data-[state=checked]:border-blue-accent"
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, category])
                                        : field.onChange(field.value?.filter((value) => value !== category))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal capitalize cursor-pointer">
                                  {category}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('preferredCategories')?.includes('other') && (
                <FormField
                  control={form.control}
                  name="otherCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-blue-accent">Specify Other Interest</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., health, science, travel" 
                          className="border-2 border-muted focus:border-blue-accent rounded-lg transition-all duration-200 bg-background/50 backdrop-blur-sm"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="preferredCountries"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">Preferred Countries</FormLabel>
                    <Select onValueChange={(value) => field.onChange([...(field.value || []), value])}>
                      <FormControl>
                        <SelectTrigger className="border-2 border-muted focus:border-blue-accent rounded-lg transition-all duration-200 bg-background/50 backdrop-blur-sm">
                          <SelectValue placeholder="Select countries" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'India', 'Brazil', 'South Africa'].map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {field.value.map((country) => (
                          <span key={country} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-gradient-to-r from-blue-accent/10 to-accent/10 text-blue-accent border border-blue-accent/20 backdrop-blur-sm">
                            {country}
                            <button
                              type="button"
                              onClick={() => field.onChange(field.value.filter(c => c !== country))}
                              className="ml-2 text-xs hover:text-accent transition-colors rounded-full w-4 h-4 flex items-center justify-center hover:bg-accent/20"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredMediaTypes"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">Media Preferences</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {['videos', 'infographics', 'articles', 'short articles'].map((mediaType) => (
                        <FormField
                          key={mediaType}
                          control={form.control}
                          name="preferredMediaTypes"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 rounded-lg border-2 border-muted hover:border-blue-accent/30 transition-all duration-200 bg-background/30 backdrop-blur-sm">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(mediaType)}
                                    className="border-2 border-blue-accent data-[state=checked]:bg-blue-accent data-[state=checked]:border-blue-accent"
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, mediaType])
                                        : field.onChange(field.value?.filter((value) => value !== mediaType))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal capitalize cursor-pointer">
                                  {mediaType}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredNewsSources"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-blue-accent">News Sources</FormLabel>
                    <div className="grid grid-cols-1 gap-3">
                      {['international publications', 'local news outlets', 'influencers', 'independent journalists'].map((source) => (
                        <FormField
                          key={source}
                          control={form.control}
                          name="preferredNewsSources"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 rounded-lg border-2 border-muted hover:border-blue-accent/30 transition-all duration-200 bg-background/30 backdrop-blur-sm">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(source)}
                                    className="border-2 border-blue-accent data-[state=checked]:bg-blue-accent data-[state=checked]:border-blue-accent"
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, source])
                                        : field.onChange(field.value?.filter((value) => value !== source))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal capitalize cursor-pointer">
                                  {source}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 bg-gradient-to-r from-blue-accent to-accent text-white hover:from-blue-accent/90 hover:to-accent/90 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? 'Creating Account...' : 'Join Community'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-blue-accent hover:bg-blue-accent/5"
                >
                  Maybe Later
                </Button>
              </div>
            </form>
          </Form>

          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">
              🔒 We respect your privacy. Unsubscribe anytime with one click.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}