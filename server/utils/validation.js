import { z } from 'zod';

// ==========================================
// 1. Auth Schemas
// ==========================================
export const authRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Valid email address is required').optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().optional()
}).refine(data => Boolean(data.email || data.phone), {
  message: 'Email address is required',
  path: ['email']
});

export const authLoginSchema = z.object({
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required')
}).refine(data => Boolean(data.email || data.phone), {
  message: 'Email address is required',
  path: ['email']
});

// ==========================================
// 2. Product Schemas
// ==========================================
export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  category: z.string().trim().min(2, 'Category is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  stock: z.coerce.number().int().nonnegative('Stock must be >= 0'),
  description: z.string().optional(),
  image: z.string().url('Invalid image URL').optional().or(z.literal(''))
});

// ==========================================
// 3. Order Schemas
// ==========================================
export const createOrderSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerPhone: z.string().min(6, 'Valid customer phone is required'),
  items: z.array(z.object({
    productId: z.string(),
    title: z.string().optional(),
    price: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive()
  })).min(1, 'Order must contain at least one item'),
  totalAmount: z.coerce.number().positive(),
  shippingAddress: z.record(z.any())
});

/**
 * Express middleware to validate request body using a Zod schema.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.flatten().fieldErrors,
        timestamp: new Date().toISOString()
      });
    }

    req.body = result.data;
    next();
  };
}

export { z };

export default {
  z,
  authRegisterSchema,
  authLoginSchema,
  createProductSchema,
  createOrderSchema,
  validateBody
};
