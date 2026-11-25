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
  name: z.string().trim().min(1, 'Product name is required'),
  category: z.string().trim().optional().default('General'),
  price: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().nonnegative('Price cannot be negative').default(0)
  ),
  stock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().int().nonnegative('Stock must be >= 0').default(0)
  ),
  description: z.string().optional().default(''),
  image: z.any().optional()
});

// ==========================================
// 3. Order Schemas
// ==========================================
export const createOrderSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  items: z.array(z.object({
    productId: z.string(),
    title: z.string().optional(),
    category: z.string().optional(),
    price: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive()
  })).min(1, 'Order must contain at least one item'),
  totalAmount: z.coerce.number().positive(),
  shippingAddress: z.record(z.any()),
  // validateBody keeps only fields listed here, so payment fields must be declared
  customerName: z.string().optional().nullable(),
  status: z.enum(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled']).optional(),
  paymentStatus: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),
  // One key per checkout attempt: a double-click or retry with the same key returns the same order
  idempotencyKey: z.string().uuid().optional()
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
