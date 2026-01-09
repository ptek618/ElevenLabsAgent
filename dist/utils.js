"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucket = void 0;
exports.normalizePhoneToE164 = normalizePhoneToE164;
exports.normalizePhoneForSonar = normalizePhoneForSonar;
exports.deriveDeviceStatus = deriveDeviceStatus;
exports.parseWifiCredentials = parseWifiCredentials;
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
function parseWifiCredentials(customFieldData) {
    const sourceFields = [];
    let combinedText = '';
    if (Array.isArray(customFieldData.custom_field_data)) {
        customFieldData.custom_field_data.forEach((field) => {
            if (field.key && field.value) {
                sourceFields.push({ key: field.key, value: field.value });
                combinedText += `${field.value}\n`;
            }
        });
    }
    if (customFieldData.custom_field_data_1) {
        sourceFields.push({ key: 'custom_field_data_1', value: customFieldData.custom_field_data_1 });
        combinedText += `${customFieldData.custom_field_data_1}\n`;
    }
    if (customFieldData.custom_field_data_2) {
        sourceFields.push({ key: 'custom_field_data_2', value: customFieldData.custom_field_data_2 });
        combinedText += `${customFieldData.custom_field_data_2}\n`;
    }
    if (!combinedText.trim()) {
        return {
            source_fields: sourceFields,
            parsing_method: 'no_data'
        };
    }
    const protekSsidPattern = /(ProTek-[^\s]+)/gi;
    const protekMatches = [...combinedText.matchAll(protekSsidPattern)];
    let ssid;
    let wpaKey;
    if (protekMatches.length > 0) {
        ssid = protekMatches[0][1].trim();
    }
    const numericPasswordPattern = /(\d{8,})/g;
    const numericMatches = [...combinedText.matchAll(numericPasswordPattern)];
    if (numericMatches.length > 0) {
        wpaKey = numericMatches[0][1].trim();
    }
    if (!ssid || !wpaKey) {
        const simplePattern = /(ProTek-[^\s]+)\s+(\d{8,})/gi;
        const simpleMatches = [...combinedText.matchAll(simplePattern)];
        if (simpleMatches.length > 0) {
            if (!ssid)
                ssid = simpleMatches[0][1].trim();
            if (!wpaKey)
                wpaKey = simpleMatches[0][2].trim();
        }
    }
    if (!ssid || !wpaKey) {
        const ssidPatterns = [
            /(?:ssid|wi-?fi|network)\s*[:|-]?\s*([^\s:|-][^\n:;|,]*?)(?:\s|$|\n)/gi,
            /([^\s:;|,\n]*wifi[^\s:;|,\n]*)/gi
        ];
        const wpaPatterns = [
            /(?:wpa2?|key|pass(?:word)?|psk)\s*[:|-]?\s*([^\s:|-][^\n:;|,]*?)(?:\s|$|\n)/gi,
            /(?:^|\s)(\d{10,})(?:\s|$)/gi,
            /([a-fA-F0-9]{64})/gi
        ];
        if (!ssid) {
            for (const pattern of ssidPatterns) {
                const matches = [...combinedText.matchAll(pattern)];
                for (const match of matches) {
                    const candidate = match[1]?.trim();
                    if (candidate && candidate.length >= 1 && candidate.length <= 32 && !candidate.match(/^\d{8,}$/)) {
                        ssid = candidate;
                        break;
                    }
                }
                if (ssid)
                    break;
            }
        }
        if (!wpaKey) {
            for (const pattern of wpaPatterns) {
                const matches = [...combinedText.matchAll(pattern)];
                for (const match of matches) {
                    const candidate = match[1]?.trim();
                    if (candidate && ((candidate.length >= 8 && candidate.length <= 63) || candidate.length === 64)) {
                        wpaKey = candidate;
                        break;
                    }
                }
                if (wpaKey)
                    break;
            }
        }
    }
    return {
        ssid,
        wpa_key: wpaKey,
        source_fields: sourceFields,
        parsing_method: 'regex_v1'
    };
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