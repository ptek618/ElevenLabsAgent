import request from 'supertest';
import nock from 'nock';
import app from '../../src/server';

nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');

const API_KEY = process.env.LOCAL_TOOL_API_KEY!;
const SONAR_BASE_URL = 'https://test.sonar.software';

describe('API Endpoints', () => {
  beforeAll(() => {
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  describe('GET /healthz', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /customer/search', () => {
    test('should search customer by name successfully', async () => {
      const mockSonarResponse = {
        data: {
          accounts: {
            edges: [
              {
                node: {
                  id: 'acc_123',
                  accountNumber: 'A-12345',
                  name: 'John Doe',
                  primaryPhone: '+16185551234',
                  emails: ['john@example.com'],
                  serviceAddress: '123 Main St, Marion, IL 62959',
                  billingAddress: 'PO Box 99, Marion, IL 62959',
                },
              },
            ],
          },
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .matchHeader('authorization', `Bearer ${process.env.SONAR_API_KEY}`)
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', API_KEY)
        .send({ name: 'John Doe' });

      expect(response.status).toBe(200);
      expect(response.body.matchType).toBe('name');
      expect(response.body.customer.name).toBe('John Doe');
      expect(response.body.exact).toBe(true);
    });

    test('should normalize phone number before search', async () => {
      const mockSonarResponse = {
        data: {
          accounts: {
            edges: [
              {
                node: {
                  id: 'acc_123',
                  accountNumber: 'A-12345',
                  name: 'John Doe',
                  primaryPhone: '+16185551234',
                  emails: [],
                  serviceAddress: '123 Main St',
                  billingAddress: '123 Main St',
                },
              },
            ],
          },
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql', (body) => {
          return body.variables.filter.phone === '+16185551234';
        })
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', API_KEY)
        .send({ phone: '(618) 555-1234' });

      expect(response.status).toBe(200);
    });

    test('should require API key', async () => {
      const response = await request(app)
        .post('/customer/search')
        .send({ name: 'John Doe' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('MISSING_API_KEY');
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', 'invalid_key')
        .send({ name: 'John Doe' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    test('should handle Sonar auth error', async () => {
      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .reply(401, { error: 'Unauthorized' });

      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', API_KEY)
        .send({ name: 'John Doe' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('SONAR_AUTH_ERROR');
    });

    test('should handle Sonar rate limit', async () => {
      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .reply(429, { error: 'Rate limit exceeded' });

      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', API_KEY)
        .send({ name: 'John Doe' });

      expect(response.status).toBe(500);
    });

    test('should validate request body', async () => {
      const response = await request(app)
        .post('/customer/search')
        .set('X-API-Key', API_KEY)
        .send({ name: 'John', phone: '123' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /customer/financials', () => {
    test('should get customer financials successfully', async () => {
      const mockSonarResponse = {
        data: {
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
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .matchHeader('authorization', `Bearer ${process.env.SONAR_API_KEY}`)
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/customer/financials')
        .set('X-API-Key', API_KEY)
        .send({ accountId: 'acc_123' });

      expect(response.status).toBe(200);
      expect(response.body.accountId).toBe('acc_123');
      expect(response.body.currentBalance).toBe(42.50);
      expect(response.body.lastPayment.amount).toBe(120.00);
    });
  });

  describe('POST /customer/notes', () => {
    test('should get customer notes successfully', async () => {
      const mockSonarResponse = {
        data: {
          account: {
            id: 'acc_123',
            notes: {
              edges: [
                {
                  node: {
                    id: 'note_1',
                    createdAt: '2023-07-14T16:04:05Z',
                    author: 'Support Agent',
                    text: 'Customer called about connectivity issues',
                  },
                },
              ],
            },
          },
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/customer/notes')
        .set('X-API-Key', API_KEY)
        .send({ accountId: 'acc_123', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.accountId).toBe('acc_123');
      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0].text).toBe('Customer called about connectivity issues');
    });
  });

  describe('POST /ticket/create', () => {
    test('should create ticket successfully', async () => {
      const mockSonarResponse = {
        data: {
          createTicket: {
            ticket: {
              id: 'ticket_123',
              number: 'T-12345',
              status: 'open',
              createdAt: '2023-07-14T16:04:05Z',
            },
            errors: [],
          },
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/ticket/create')
        .set('X-API-Key', API_KEY)
        .send({
          accountId: 'acc_123',
          title: 'Internet Down',
          body: 'Customer reports no internet connectivity',
          priority: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.body.ticketId).toBe('ticket_123');
      expect(response.body.ticketNumber).toBe('T-12345');
      expect(response.body.status).toBe('open');
    });
  });

  describe('POST /customer/inventory', () => {
    test('should get customer inventory successfully', async () => {
      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const mockSonarResponse = {
        data: {
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
              ],
            },
          },
        },
      };

      nock(SONAR_BASE_URL)
        .post('/api/graphql')
        .reply(200, mockSonarResponse);

      const response = await request(app)
        .post('/customer/inventory')
        .set('X-API-Key', API_KEY)
        .send({ accountId: 'acc_123' });

      expect(response.status).toBe(200);
      expect(response.body.accountId).toBe('acc_123');
      expect(response.body.inventory).toHaveLength(1);
      expect(response.body.inventory[0].status).toBe('online');
    });
  });
});
