export function normalizePhoneToE164(phone: string): string {
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

export function normalizePhoneForSonar(phone: string): string {
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

export function deriveDeviceStatus(lastSeenAt?: string): 'online' | 'offline' | 'unknown' {
  if (!lastSeenAt) {
    return 'unknown';
  }
  
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  return lastSeen > fiveMinutesAgo ? 'online' : 'offline';
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
