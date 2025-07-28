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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-lg font-medium">
            sign up for updates
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground lowercase">
            get the latest feature upgrades and exclusive discounts delivered straight to your inbox.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium lowercase">first name</FormLabel>
                    <FormControl>
                      <Input placeholder="enter your first name" {...field} />
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
                    <FormLabel className="text-sm font-medium lowercase">email address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="enter your email"
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
                    <FormLabel className="text-sm font-medium lowercase">year of birth</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 1990"
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
                    <FormLabel className="text-sm font-medium lowercase">what do you like?</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {['business', 'sport', 'politics', 'technology', 'entertainment', 'other'].map((category) => (
                        <FormField
                          key={category}
                          control={form.control}
                          name="preferredCategories"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, category])
                                        : field.onChange(field.value?.filter((value) => value !== category))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal lowercase">
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
                      <FormLabel className="text-sm font-medium lowercase">specify your other interest</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., health, science, travel" {...field} />
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
                    <FormLabel className="text-sm font-medium lowercase">where do you want to see news from?</FormLabel>
                    <Select onValueChange={(value) => field.onChange([...field.value, value])}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="select countries" />
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
                          <span key={country} className="inline-flex items-center px-2 py-1 rounded text-xs bg-secondary text-secondary-foreground">
                            {country}
                            <button
                              type="button"
                              onClick={() => field.onChange(field.value.filter(c => c !== country))}
                              className="ml-1 text-xs hover:text-destructive"
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
                    <FormLabel className="text-sm font-medium lowercase">what media do you like consuming?</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {['videos', 'infographics', 'articles', 'short articles'].map((mediaType) => (
                        <FormField
                          key={mediaType}
                          control={form.control}
                          name="preferredMediaTypes"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(mediaType)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, mediaType])
                                        : field.onChange(field.value?.filter((value) => value !== mediaType))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal lowercase">
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
                    <FormLabel className="text-sm font-medium lowercase">who do you want to hear news from?</FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {['international publications', 'local news outlets', 'influencers', 'independent journalists'].map((source) => (
                        <FormField
                          key={source}
                          control={form.control}
                          name="preferredNewsSources"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(source)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, source])
                                        : field.onChange(field.value?.filter((value) => value !== source))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal lowercase">
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

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? 'signing up...' : 'sign up'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDismiss}
                  className="flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                >
                  maybe later
                </Button>
              </div>
            </form>
          </Form>

          <p className="text-xs text-muted-foreground lowercase">
            we respect your privacy. you can unsubscribe at any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}