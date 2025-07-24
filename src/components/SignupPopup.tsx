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

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  email: z.string().email('Please enter a valid email address'),
  yearOfBirth: z
    .number()
    .min(1920, 'Year must be between 1920 and 2010')
    .max(2010, 'Year must be between 1920 and 2010'),
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
      <DialogContent className="sm:max-w-md">
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