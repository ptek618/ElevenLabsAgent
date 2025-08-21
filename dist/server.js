"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./auth");
const health_1 = require("./health");
const sonarClient_1 = require("./sonarClient");
const utils_1 = require("./utils");
const validators_1 = require("./validators");
const mappers_1 = require("./mappers");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const sonarClient = new sonarClient_1.SonarClient(process.env.SONAR_API_URL, process.env.SONAR_API_KEY);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('combined', {
    skip: (req) => req.url === '/healthz'
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/healthz', health_1.healthCheck);
const cleanSearchRequest = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const { name, accountNumber, address, phone, email } = req.body;
        const fields = [
            { key: 'accountNumber', value: accountNumber },
            { key: 'name', value: name },
            { key: 'phone', value: phone },
            { key: 'email', value: email },
            { key: 'address', value: address }
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== '');
        if (fields.length > 1) {
            const prioritizedField = fields[0];
            req.body = { [prioritizedField.key]: prioritizedField.value };
        }
    }
    next();
};
app.post('/customer/search', auth_1.validateApiKey, cleanSearchRequest, async (req, res) => {
    try {
        const validatedData = validators_1.customerSearchSchema.parse(req.body);
        let searchType;
        let searchValue;
        let filter = {};
        if (validatedData.name) {
            searchType = 'name';
            searchValue = validatedData.name;
            filter.name = searchValue;
        }
        else if (validatedData.accountNumber) {
            searchType = 'accountNumber';
            searchValue = validatedData.accountNumber;
            filter.accountNumber = searchValue;
        }
        else if (validatedData.address) {
            searchType = 'address';
            searchValue = validatedData.address;
            filter.address = searchValue;
        }
        else if (validatedData.phone) {
            searchType = 'phone';
            searchValue = (0, utils_1.normalizePhoneToE164)(validatedData.phone);
            filter.phone = searchValue;
        }
        else if (validatedData.email) {
            searchType = 'email';
            searchValue = validatedData.email;
            filter.email = searchValue;
        }
        else {
            const error = {
                ok: false,
                code: 'INVALID_REQUEST',
                message: 'Exactly one search field must be provided (name, accountNumber, address, phone, or email)',
            };
            return res.status(400).json(error);
        }
        const data = await sonarClient.searchAccounts(filter);
        const response = (0, mappers_1.mapAccountSearchResponse)(data, searchType);
        res.json(response);
    }
    catch (error) {
        console.error('Customer search error:', error);
        if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
            const apiError = {
                ok: false,
                code: 'INVALID_REQUEST',
                message: 'Validation failed',
                details: error.errors,
            };
            return res.status(400).json(apiError);
        }
        if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
            const apiError = error;
            return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
        }
        const apiError = {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
        res.status(500).json(apiError);
    }
});
app.post('/customer/financials', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.customerFinancialsSchema.parse(req.body);
        const data = await sonarClient.getAccountFinancials(validatedData.accountId);
        const response = (0, mappers_1.mapAccountFinancialsResponse)(data, validatedData.accountId);
        res.json(response);
    }
    catch (error) {
        console.error('Customer financials error:', error);
        if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
            const apiError = error;
            return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
        }
        const apiError = {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
        res.status(500).json(apiError);
    }
});
app.post('/customer/notes', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.customerNotesSchema.parse(req.body);
        const data = await sonarClient.getAccountNotes(validatedData.accountId, validatedData.limit, validatedData.since);
        const response = (0, mappers_1.mapAccountNotesResponse)(data, validatedData.accountId);
        res.json(response);
    }
    catch (error) {
        console.error('Customer notes error:', error);
        if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
            const apiError = error;
            return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
        }
        const apiError = {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
        res.status(500).json(apiError);
    }
});
app.post('/ticket/create', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.ticketCreateSchema.parse(req.body);
        const data = await sonarClient.createTicket(validatedData);
        const response = (0, mappers_1.mapTicketCreateResponse)(data);
        res.json(response);
    }
    catch (error) {
        console.error('Ticket create error:', error);
        if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
            const apiError = error;
            return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
        }
        const apiError = {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
        res.status(500).json(apiError);
    }
});
app.post('/customer/inventory', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.customerInventorySchema.parse(req.body);
        const data = await sonarClient.getAccountInventory(validatedData.accountId);
        const response = (0, mappers_1.mapAccountInventoryResponse)(data, validatedData.accountId);
        res.json(response);
    }
    catch (error) {
        console.error('Customer inventory error:', error);
        if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
            const apiError = error;
            return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
        }
        const apiError = {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
        res.status(500).json(apiError);
    }
});
app.use((req, res) => {
    const error = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
    };
    res.status(404).json(error);
});
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    const apiError = {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
    };
    res.status(500).json(apiError);
});
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map