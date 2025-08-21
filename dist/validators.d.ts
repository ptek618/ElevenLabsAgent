import { z } from 'zod';
export declare const customerSearchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    accountNumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const customerFinancialsSchema: z.ZodObject<{
    accountId: z.ZodString;
}, z.core.$strip>;
export declare const customerNotesSchema: z.ZodObject<{
    accountId: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    since: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ticketCreateSchema: z.ZodObject<{
    accountId: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    priority: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const customerInventorySchema: z.ZodObject<{
    accountId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map