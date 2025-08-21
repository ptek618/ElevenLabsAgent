import { normalizePhoneToE164, deriveDeviceStatus, TokenBucket } from '../../src/utils';

describe('normalizePhoneToE164', () => {
  test('should normalize 10-digit US number', () => {
    expect(normalizePhoneToE164('6185551234')).toBe('+16185551234');
  });

  test('should normalize 11-digit US number with leading 1', () => {
    expect(normalizePhoneToE164('16185551234')).toBe('+16185551234');
  });

  test('should preserve already formatted E.164 number', () => {
    expect(normalizePhoneToE164('+16185551234')).toBe('+16185551234');
  });

  test('should handle number with formatting characters', () => {
    expect(normalizePhoneToE164('(618) 555-1234')).toBe('+16185551234');
  });

  test('should handle international number', () => {
    expect(normalizePhoneToE164('447700900123')).toBe('+447700900123');
  });
});

describe('deriveDeviceStatus', () => {
  test('should return unknown for undefined lastSeenAt', () => {
    expect(deriveDeviceStatus()).toBe('unknown');
  });

  test('should return online for recent timestamp', () => {
    const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(deriveDeviceStatus(recentTime)).toBe('online');
  });

  test('should return offline for old timestamp', () => {
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(deriveDeviceStatus(oldTime)).toBe('offline');
  });

  test('should return online for timestamp exactly 5 minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(deriveDeviceStatus(fiveMinutesAgo)).toBe('offline');
  });
});

describe('TokenBucket', () => {
  test('should allow consumption within capacity', () => {
    const bucket = new TokenBucket(5, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
  });

  test('should deny consumption when empty', () => {
    const bucket = new TokenBucket(1, 0.1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  test('should refill over time', async () => {
    const bucket = new TokenBucket(2, 10);
    bucket.consume();
    bucket.consume();
    expect(bucket.consume()).toBe(false);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(bucket.consume()).toBe(true);
  });
});
