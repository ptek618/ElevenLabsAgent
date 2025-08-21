"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerInventorySchema = exports.ticketCreateSchema = exports.customerNotesSchema = exports.customerFinancialsSchema = exports.customerSearchSchema = void 0;
const zod_1 = require("zod");
exports.customerSearchSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    accountNumber: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
}).refine((data) => {
    const fields = [data.name, data.accountNumber, data.address, data.phone, data.email];
    const definedFields = fields.filter(field => field !== undefined);
    return definedFields.length === 1;
}, {
    message: "Exactly one of name, accountNumber, address, phone, or email must be provided",
});
exports.customerFinancialsSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, "Account ID is required"),
});
exports.customerNotesSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, "Account ID is required"),
    limit: zod_1.z.number().int().positive().max(100).optional(),
    since: zod_1.z.string().datetime().optional(),
});
exports.ticketCreateSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, "Account ID is required"),
    title: zod_1.z.string().min(1, "Title is required"),
    body: zod_1.z.string().min(1, "Body is required"),
    priority: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
});
exports.customerInventorySchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, "Account ID is required"),
});
//# sourceMappingURL=validators.js.map