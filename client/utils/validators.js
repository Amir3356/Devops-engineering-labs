import { z } from 'zod';

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, 'Phone number must be at least 6 digits')
    .regex(/^[+0-9\s-]{6,20}$/, 'Invalid phone number format'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters'),
    phone: z
      .string()
      .trim()
      .min(6, 'Phone number must be at least 6 digits')
      .regex(/^[+0-9\s-]{6,20}$/, 'Invalid phone number format'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const shippingSchema = z.object({
  name: z.string().trim().min(2, 'Name is required (at least 2 characters)'),
  phone: z.string().trim().min(6, 'Valid phone number is required'),
  street: z.string().trim().min(3, 'Street address is required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State / Province is required'),
  zip: z.string().trim().min(3, 'Postal code is required'),
});

export const productSchema = z.object({
  name: z.string().trim().min(3, 'Product name must be at least 3 characters'),
  category: z.string().trim().min(2, 'Category is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  stock: z.coerce.number().int().nonnegative('Stock cannot be negative'),
  description: z.string().optional(),
});
