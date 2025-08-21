"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = validateApiKey;
function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.LOCAL_TOOL_API_KEY;
    if (!expectedApiKey) {
        const error = {
            ok: false,
            code: 'SERVER_CONFIG_ERROR',
            message: 'Server configuration error: API key not configured',
        };
        return res.status(500).json(error);
    }
    if (!apiKey) {
        const error = {
            ok: false,
            code: 'MISSING_API_KEY',
            message: 'X-API-Key header is required',
        };
        return res.status(401).json(error);
    }
    if (apiKey !== expectedApiKey) {
        const error = {
            ok: false,
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
        };
        return res.status(401).json(error);
    }
    next();
}
//# sourceMappingURL=auth.js.map