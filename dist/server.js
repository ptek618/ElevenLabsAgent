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
const statusPageClient_1 = require("./statusPageClient");
const utils_1 = require("./utils");
const validators_1 = require("./validators");
const mappers_1 = require("./mappers");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
const sonarClient = new sonarClient_1.SonarClient(process.env.SONAR_API_URL, process.env.SONAR_API_KEY);
const statusPageClient = new statusPageClient_1.StatusPageClient();
const WHITELISTED_IPS = [
    '34.67.146.145', // US (Default)
    '34.59.11.47', // US (Default)
    '35.204.38.71', // EU
    '34.147.113.54', // EU
    '35.185.187.110', // Asia
    '35.247.157.189', // Asia
    '20.221.112.37', // US Azure egress
    '20.221.114.13', // US Azure egress
    '52.158.209.86', // US Azure egress
    '20.104.33.4', // Canada Azure ingress/egress
    '52.185.28.83', // Hardware/Client Equipment access
    '20.84.183.202', // Instance Access/Application Firewall
    '34.200.64.243',
    '54.157.231.76',
    '18.206.32.254',
    '52.183.72.253' // Temporary testing IP
];
const ipWhitelist = (req, res, next) => {
    if (req.path === '/healthz') {
        return next();
    }
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIP;
    if (process.env.NODE_ENV !== 'production' &&
        (realIP === '127.0.0.1' || realIP === '::1' || realIP === '::ffff:127.0.0.1' || realIP?.includes('localhost'))) {
        return next();
    }
    if (realIP && WHITELISTED_IPS.includes(realIP)) {
        return next();
    }
    console.warn(`Blocked request from unauthorized IP: ${realIP}`);
    return res.status(403).json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Access denied: IP not whitelisted'
    });
};
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.set('trust proxy', true); // Trust proxy for accurate IP detection
app.use((0, morgan_1.default)('combined', {
    skip: (req) => req.url === '/healthz'
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(ipWhitelist);
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
app.post('/wifi/credentials', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.wifiCredentialsSchema.parse(req.body);
        let accountId;
        if (validatedData.account_id) {
            accountId = validatedData.account_id;
        }
        else {
            let filter = {};
            if (validatedData.phone) {
                filter.phone = (0, utils_1.normalizePhoneToE164)(validatedData.phone);
            }
            else if (validatedData.email) {
                filter.email = validatedData.email;
            }
            else if (validatedData.name) {
                filter.name = validatedData.name;
            }
            try {
                const searchData = await sonarClient.searchAccounts(filter);
                const searchResponse = (0, mappers_1.mapAccountSearchResponse)(searchData, validatedData.phone ? 'phone' : validatedData.email ? 'email' : 'name');
                if (!searchResponse.customer) {
                    return res.json({
                        found: false,
                        reason: 'not_found',
                        details: 'No account found matching the provided criteria'
                    });
                }
                if (searchResponse.candidates.length > 0) {
                    return res.json({
                        found: false,
                        reason: 'ambiguous_account',
                        details: 'Multiple accounts found matching the criteria',
                        candidates: searchResponse.candidates.map(c => ({
                            account_id: c.id,
                            name: c.name
                        }))
                    });
                }
                accountId = searchResponse.customer.id;
            }
            catch (searchError) {
                console.error('Account search error:', searchError);
                return res.json({
                    found: false,
                    reason: 'graphql_error',
                    details: 'Error searching for account'
                });
            }
        }
        if (!accountId) {
            return res.json({
                found: false,
                reason: 'not_found',
                details: 'Could not resolve account ID'
            });
        }
        const data = await sonarClient.getAccountInstallJobs(accountId);
        const response = (0, mappers_1.mapAccountInstallJobsResponse)(data, accountId);
        res.json(response);
    }
    catch (error) {
        console.error('Wi-Fi credentials error:', error);
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
app.post('/status/recent-updates', auth_1.validateApiKey, async (req, res) => {
    try {
        const validatedData = validators_1.statusPageSchema.parse(req.body);
        const statusData = await statusPageClient.scrapeStatusPage();
        const response = (0, mappers_1.mapStatusPageResponse)(statusData);
        res.json(response);
    }
    catch (error) {
        console.error('Status page scraping error:', error);
        if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
            const apiError = {
                ok: false,
                code: 'INVALID_REQUEST',
                message: 'Validation failed',
                details: error.errors,
            };
            return res.status(400).json(apiError);
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