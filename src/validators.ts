import { z } from 'zod';

export const customerSearchSchema = z.object({
  name: z.string().optional(),
  accountNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
}).refine(
  (data) => {
    const fields = [data.name, data.accountNumber, data.address, data.phone, data.email];
    const definedFields = fields.filter(field => field !== undefined);
    return definedFields.length === 1;
  },
  {
    message: "Exactly one of name, accountNumber, address, phone, or email must be provided",
  }
);

export const customerFinancialsSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});

export const customerNotesSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  limit: z.number().int().positive().max(100).optional(),
  since: z.string().datetime().optional(),
});

export const ticketCreateSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  priority: z.string().optional(),
  category: z.string().optional(),
});

export const customerInventorySchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});
