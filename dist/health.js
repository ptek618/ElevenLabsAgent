"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = healthCheck;
function healthCheck(req, res) {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
}
//# sourceMappingURL=health.js.map