import {
  mapAccountSearchResponse,
  mapAccountFinancialsResponse,
  mapAccountNotesResponse,
  mapTicketCreateResponse,
  mapAccountInventoryResponse,
} from '../../src/mappers';

describe('mapAccountSearchResponse', () => {
  test('should map single account correctly', () => {
    const mockData = {
      accounts: {
        edges: [
          {
            node: {
              id: 'acc_123',
              accountNumber: 'A-12345',
              name: 'John Doe',
              primaryPhone: '+16185551234',
              emails: ['john@example.com'],
              serviceAddress: '123 Main St',
              billingAddress: '123 Main St',
            },
          },
        ],
      },
    };

    const result = mapAccountSearchResponse(mockData, 'name');

    expect(result.matchType).toBe('name');
    expect(result.exact).toBe(true);
    expect(result.customer.id).toBe('acc_123');
    expect(result.customer.name).toBe('John Doe');
    expect(result.candidates).toHaveLength(0);
  });

  test('should map multiple accounts with candidates', () => {
    const mockData = {
      accounts: {
        edges: [
          {
            node: {
              id: 'acc_123',
              accountNumber: 'A-12345',
              name: 'John Doe',
              primaryPhone: '+16185551234',
              emails: ['john@example.com'],
              serviceAddress: '123 Main St',
              billingAddress: '123 Main St',
            },
          },
          {
            node: {
              id: 'acc_456',
              accountNumber: 'A-67890',
              name: 'Jane Doe',
              primaryPhone: '+16185555678',
              emails: [],
              serviceAddress: '456 Oak Ave',
              billingAddress: '456 Oak Ave',
            },
          },
        ],
      },
    };

    const result = mapAccountSearchResponse(mockData, 'name');

    expect(result.exact).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe('acc_456');
    expect(result.candidates[0].name).toBe('Jane Doe');
  });

  test('should throw error for empty results', () => {
    const mockData = { accounts: { edges: [] } };
    expect(() => mapAccountSearchResponse(mockData, 'name')).toThrow('No accounts found');
  });
});

describe('mapAccountFinancialsResponse', () => {
  test('should map account with payment', () => {
    const mockData = {
      account: {
        id: 'acc_123',
        currentBalance: 42.50,
        payments: {
          edges: [
            {
              node: {
                createdAt: '2023-07-14T16:04:05Z',
                amount: 120.00,
                method: 'CreditCard',
                reference: 'ch_abc123',
              },
            },
          ],
        },
      },
    };

    const result = mapAccountFinancialsResponse(mockData);

    expect(result.accountId).toBe('acc_123');
    expect(result.currentBalance).toBe(42.50);
    expect(result.lastPayment).toEqual({
      date: '2023-07-14T16:04:05Z',
      amount: 120.00,
      method: 'CreditCard',
      reference: 'ch_abc123',
    });
  });

  test('should handle account with no payments', () => {
    const mockData = {
      account: {
        id: 'acc_123',
        currentBalance: 0,
        payments: { edges: [] },
      },
    };

    const result = mapAccountFinancialsResponse(mockData);

    expect(result.lastPayment).toBeNull();
  });

  test('should throw error for missing account', () => {
    const mockData = {};
    expect(() => mapAccountFinancialsResponse(mockData)).toThrow('Account not found');
  });
});

describe('mapAccountInventoryResponse', () => {
  test('should map inventory with status derivation', () => {
    const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const mockData = {
      account: {
        id: 'acc_123',
        inventory: {
          edges: [
            {
              node: {
                id: 'inv_1',
                type: 'Router',
                model: 'RT-AC68U',
                macAddress: '00:11:22:33:44:55',
                serialNumber: 'SN123456',
                lastSeenAt: recentTime,
              },
            },
            {
              node: {
                id: 'inv_2',
                type: 'Modem',
                model: 'CM1000',
                macAddress: '66:77:88:99:AA:BB',
                serialNumber: 'SN789012',
                lastSeenAt: oldTime,
              },
            },
            {
              node: {
                id: 'inv_3',
                type: 'Switch',
                model: 'GS108',
                macAddress: 'CC:DD:EE:FF:00:11',
                serialNumber: 'SN345678',
                lastSeenAt: null,
              },
            },
          ],
        },
      },
    };

    const result = mapAccountInventoryResponse(mockData);

    expect(result.accountId).toBe('acc_123');
    expect(result.inventory).toHaveLength(3);
    expect(result.inventory[0].status).toBe('online');
    expect(result.inventory[1].status).toBe('offline');
    expect(result.inventory[2].status).toBe('unknown');
  });
});
