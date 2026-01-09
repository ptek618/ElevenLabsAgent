export declare function normalizePhoneToE164(phone: string): string;
export declare function normalizePhoneForSonar(phone: string): string;
export declare function deriveDeviceStatus(lastSeenAt?: string): 'online' | 'offline' | 'unknown';
export interface ParsedWifiCredentials {
    ssid?: string;
    wpa_key?: string;
    source_fields: Array<{
        key: string;
        value: string;
    }>;
    parsing_method: string;
}
export declare function parseWifiCredentials(customFieldData: any): ParsedWifiCredentials;
export declare class TokenBucket {
    private tokens;
    private lastRefill;
    private readonly capacity;
    private readonly refillRate;
    constructor(capacity: number, refillRate: number);
    consume(): boolean;
    private refill;
}
//# sourceMappingURL=utils.d.ts.map