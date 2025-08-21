"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucket = void 0;
exports.normalizePhoneToE164 = normalizePhoneToE164;
exports.normalizePhoneForSonar = normalizePhoneForSonar;
exports.deriveDeviceStatus = deriveDeviceStatus;
function normalizePhoneToE164(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }
    if (phone.startsWith('+')) {
        return phone;
    }
    return `+${cleaned}`;
}
function normalizePhoneForSonar(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return cleaned;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return cleaned.substring(1);
    }
    if (phone.startsWith('+1')) {
        return phone.substring(2);
    }
    if (phone.startsWith('+')) {
        return phone.substring(1);
    }
    return cleaned;
}
function deriveDeviceStatus(lastSeenAt) {
    if (!lastSeenAt) {
        return 'unknown';
    }
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return lastSeen > fiveMinutesAgo ? 'online' : 'offline';
}
class TokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }
    consume() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }
    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        const tokensToAdd = timePassed * this.refillRate;
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
}
exports.TokenBucket = TokenBucket;
//# sourceMappingURL=utils.js.map