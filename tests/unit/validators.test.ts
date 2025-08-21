import {
  customerSearchSchema,
  customerFinancialsSchema,
  customerNotesSchema,
  ticketCreateSchema,
  customerInventorySchema,
} from '../../src/validators';

describe('customerSearchSchema', () => {
  test('should accept valid name search', () => {
    const result = customerSearchSchema.parse({ name: 'John Doe' });
    expect(result.name).toBe('John Doe');
  });

  test('should accept valid phone search', () => {
    const result = customerSearchSchema.parse({ phone: '+16185551234' });
    expect(result.phone).toBe('+16185551234');
  });

  test('should reject multiple fields', () => {
    expect(() => {
      customerSearchSchema.parse({ name: 'John', phone: '123' });
    }).toThrow();
  });

  test('should reject empty object', () => {
    expect(() => {
      customerSearchSchema.parse({});
    }).toThrow();
  });
});

describe('customerFinancialsSchema', () => {
  test('should accept valid accountId', () => {
    const result = customerFinancialsSchema.parse({ accountId: 'acc_123' });
    expect(result.accountId).toBe('acc_123');
  });

  test('should reject empty accountId', () => {
    expect(() => {
      customerFinancialsSchema.parse({ accountId: '' });
    }).toThrow();
  });
});

describe('customerNotesSchema', () => {
  test('should accept valid request with optional fields', () => {
    const result = customerNotesSchema.parse({
      accountId: 'acc_123',
      limit: 10,
      since: '2023-01-01T00:00:00Z',
    });
    expect(result.accountId).toBe('acc_123');
    expect(result.limit).toBe(10);
  });

  test('should reject invalid limit', () => {
    expect(() => {
      customerNotesSchema.parse({ accountId: 'acc_123', limit: -1 });
    }).toThrow();
  });
});

describe('ticketCreateSchema', () => {
  test('should accept valid ticket data', () => {
    const result = ticketCreateSchema.parse({
      accountId: 'acc_123',
      title: 'Test Issue',
      body: 'Description of the issue',
    });
    expect(result.title).toBe('Test Issue');
  });

  test('should reject empty title', () => {
    expect(() => {
      ticketCreateSchema.parse({
        accountId: 'acc_123',
        title: '',
        body: 'Description',
      });
    }).toThrow();
  });
});

describe('customerInventorySchema', () => {
  test('should accept valid accountId', () => {
    const result = customerInventorySchema.parse({ accountId: 'acc_123' });
    expect(result.accountId).toBe('acc_123');
  });
});
