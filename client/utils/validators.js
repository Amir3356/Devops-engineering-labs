import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
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
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address'),
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
  email: z.string().trim().email('Valid email address is required'),
  street: z.string().trim().min(3, 'Street address is required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State / Province is required'),
  zip: z.string().trim().min(3, 'Postal code is required'),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  category: z.string().trim().optional().default('General'),
  // Price isn't entered on the Add Product form; new products start at 0
  price: z.coerce.number().nonnegative('Price cannot be negative').default(0),
  stock: z.coerce.number().int().nonnegative('Stock cannot be negative').default(0),
  description: z.string().optional(),
  image: z.any().optional(),
});
