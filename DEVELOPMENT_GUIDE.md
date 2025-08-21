# ElevenLabs-Sonar Webhook Integration Development Guide

## Overview

This project provides a Node.js/TypeScript webhook service that integrates ElevenLabs conversational AI agents with Sonar ISP management software via GraphQL. The service exposes HTTPS endpoints that ElevenLabs "server tools" can call to perform customer operations like search, financials, notes, ticket creation, and inventory management.

## Architecture

```
ElevenLabs Agent → Webhook Endpoints → GraphQL Client → Sonar API
                ↓
            Dynamic Variables (customer_name, account_id, etc.)
```

### Key Components

- **Express Server** (`src/server.ts`): HTTPS webhook endpoints with authentication
- **GraphQL Client** (`src/sonarClient.ts`): Sonar API integration with rate limiting
- **Response Mappers** (`src/mappers.ts`): Transform Sonar data to normalized responses
- **ElevenLabs Tools** (`scripts/create-elevenlabs-tools.js`): Tool configurations via API

## Project Structure

```
/src
  server.ts              # Express app with webhook endpoints
  sonarClient.ts         # GraphQL client for Sonar API
  mappers.ts             # Response transformation logic
  validators.ts          # Zod request validation schemas
  types.ts               # TypeScript type definitions
  utils.ts               # Phone normalization and utilities
  auth.ts                # API key authentication
  health.ts              # Health check endpoint

/scripts
  create-elevenlabs-tools.js    # ElevenLabs tool creation via API
  cleanup-duplicate-tools.js    # Tool management utilities
  system-prompt.md              # Agent system prompt template

/tests
  unit/                  # Unit tests for mappers, validators, utils
  integration/           # Integration tests with mocked Sonar API
```

## Environment Setup

### Required Environment Variables

```bash
# Sonar API Configuration
SONAR_API_URL=https://protek.sonar.software/api/graphql
SONAR_API_KEY=<your_sonar_bearer_token>

# Local Service Configuration
LOCAL_TOOL_API_KEY=<random_api_key_for_webhook_auth>
PORT=8080

# ElevenLabs Integration
ELEVENLABS_API_KEY=<your_elevenlabs_api_key>
PUBLIC_BASE_URL=https://your-deployed-service.com

# Deployment (Fly.io)
FLY_API_TOKEN=<your_fly_token>
```

### Installation

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build

# Start development server
npm run dev

# Start production server
npm start
```

## API Endpoints

All endpoints require `X-API-Key` header authentication and accept JSON POST requests.

### 1. Customer Search (`/customer/search`)

**Purpose**: Find customers by name, account number, address, phone, or email.

**Request Body** (exactly one field required):
```json
{
  "name": "John Doe",           // Full or partial name
  "accountNumber": "12345",     // Numeric account ID
  "address": "123 Main St",     // Service address
  "phone": "+16185551234",      // E.164 format preferred
  "email": "john@example.com"   // Email address
}
```

**Response**:
```json
{
  "matchType": "phone",
  "exact": true,
  "customer": {
    "id": "8586",
    "accountNumber": "8586",
    "name": "Kyle Rix",
    "primaryPhone": "(618) 555-1234",
    "emails": ["kyle@example.com"],
    "serviceAddress": "123 Main St, Marion, IL 62959",
    "billingAddress": "123 Main St, Marion, IL 62959"
  },
  "candidates": []  // Additional matches if multiple found
}
```

### 2. Customer Financials (`/customer/financials`)

**Purpose**: Get current balance, billing plan, delinquent status, and payment history.

**Request Body**:
```json
{
  "accountId": "8586"
}
```

**Response**:
```json
{
  "accountId": "8586",
  "currentBalance": 0.00,
  "billingPlan": "Residential 100/20",
  "isDelinquent": false,
  "lastPayment": {
    "date": "2025-07-14T16:04:05Z",
    "amount": 120.00,
    "method": "CreditCard",
    "reference": "ch_abc123"
  }
}
```

### 3. Customer Notes (`/customer/notes`)

**Purpose**: Retrieve customer support notes and history.

**Request Body**:
```json
{
  "accountId": "8586",
  "limit": 10,      // Optional, max 100
  "since": "2025-01-01T00:00:00Z"  // Optional ISO datetime
}
```

### 4. Ticket Creation (`/ticket/create`)

**Purpose**: Create support tickets with automatic group assignment.

**Request Body**:
```json
{
  "accountId": "8586",
  "title": "Internet connectivity issue",
  "body": "Customer reports intermittent connection drops",
  "priority": "medium",  // low, medium, high, urgent
  "category": "no internet"  // billing, construction, no internet, new sign up, general
}
```

**Group Assignment Logic**:
- `billing` → ID 52 (AI Generated - Billing Issues)
- `construction` → ID 50 (AI Generated - Construction Issues)
- `no internet` → ID 51 (AI Generated - No Internet)
- `new sign up` → ID 54 (AI Generated - New Sign Up)
- `general` (default) → ID 49 (AI Generated - General Support)

### 5. Customer Inventory (`/customer/inventory`)

**Purpose**: List customer equipment with status from serviceable addresses.

**Request Body**:
```json
{
  "accountId": "8586"
}
```

**Response**:
```json
{
  "accountId": "8586",
  "inventory": [
    {
      "id": "11951",
      "type": "Router",
      "model": "841-t6",
      "mac": "N/A",        // Limited by GraphQL schema
      "serial": "N/A",     // Limited by GraphQL schema
      "status": "online",  // online, offline, unknown
      "icmpDeviceStatus": "UP"
    }
  ]
}
```

## Sonar GraphQL Integration

### Authentication
All Sonar API requests require:
```
Authorization: Bearer <SONAR_API_KEY>
Content-Type: application/json
```

### Rate Limiting
- **Sonar Limit**: 400 requests/minute per user
- **Implementation**: Token bucket with 5 RPS limit and exponential backoff

### Key GraphQL Queries

#### Phone Number Search
```graphql
query SearchByPhone($phone: String!) {
  phone_numbers(filter: { number: $phone }) {
    entities {
      number
      number_formatted
      contact {
        contactable_type
        contactable {
          ... on Account {
            id
            name
            addresses { entities { line1 city zip } }
            emails { entities { email_address } }
          }
        }
      }
    }
  }
}
```

#### Account Financials
```graphql
query AccountFinancials($accountId: ID!) {
  accounts(filter: { id: $accountId }) {
    entities {
      id
      is_delinquent
      invoices(filter: { remaining_due_greater_than: 0 }) {
        entities { remaining_due }
      }
      account_services {
        entities {
          service { name }
        }
      }
      payments(first: 1, reverse: true) {
        entities {
          created_at
          amount
          payment_type
          reference
        }
      }
    }
  }
}
```

#### Inventory from Serviceable Addresses
```graphql
query AccountInventory($accountId: ID!) {
  accounts(filter: { id: $accountId }) {
    entities {
      addresses {
        entities {
          inventory_items {
            entities {
              id
              overall_status
              icmp_device_status
              inventory_model {
                device_type
                model_name
                name
              }
            }
          }
        }
      }
    }
  }
}
```

## ElevenLabs Tool Configuration

### Tool Creation Script

Run `node scripts/create-elevenlabs-tools.js` to create all 5 tools via ElevenLabs API.

### Dynamic Variables

Each tool assigns response data to dynamic variables for conversational reuse:

**Customer Search**:
- `customer_name` → `customer.name`
- `account_number` → `customer.accountNumber`
- `account_id` → `customer.id`
- `customer_email` → `customer.emails.0`
- `customer_phone` → `customer.primaryPhone`

**Customer Financials**:
- `current_balance` → `currentBalance`
- `billing_plan` → `billingPlan`
- `is_delinquent` → `isDelinquent`
- `last_payment_amount` → `lastPayment.amount`
- `last_payment_date` → `lastPayment.date`

### Authentication Headers

Tools use custom headers with ElevenLabs secrets:
```json
{
  "request_headers": {
    "X-API-Key": "secret__LOCAL_TOOL_API_KEY"
  }
}
```

## Deployment

### Fly.io Production

```bash
# Deploy to production
flyctl deploy --app elevenlabs-sonar-tools

# View logs
flyctl logs --app elevenlabs-sonar-tools

# Check status
flyctl status --app elevenlabs-sonar-tools
```

### Health Checks

- **Endpoint**: `GET /healthz`
- **Response**: `{"status": "ok", "timestamp": "..."}`
- **Fly.io**: Configured for HTTP health checks on port 8080

## Testing

### Test Accounts for Verification

**Kyle Rix (ID: 8586)**
- Balance: $0
- Phone: Test with customer search
- Inventory: 841-t6, ONU 630 10G SFP+, 8734v

**Eddie Aldrich (ID: 5755)**
- Balance: $193
- Inventory: airCube ISP (down), LiteBeam 5AC (Good)

**Aaron Bennett (ID: 10482)**
- Balance: $0
- Inventory: Verizon CSG M519 (Good)

### Phone Number Test Cases

- `618-922-6759` → Cameron McCurdy
- `618-534-5594` → Bob Bundren
- `618-751-0845` → Sally Pearce

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires mocked Sonar)
npm run test:integration

# All tests
npm test
```

## Troubleshooting

### Common Issues

1. **Phone Search Returns Wrong Customer**
   - Verify `customer_phone` dynamic variable is configured
   - Check phone number extraction in `mappers.ts`
   - Ensure GraphQL query returns `number_formatted` field

2. **Balance Calculation Incorrect**
   - Sonar returns monetary values in cents
   - Always divide by 100 for display values
   - Filter invoices by `remaining_due > 0`

3. **Inventory 500 Errors**
   - Use `serviceableAddresses` path instead of direct inventory
   - Handle missing `inventory_model` gracefully
   - Check `overall_status` and `icmp_device_status` fields

4. **Ticket Creation in Wrong Group**
   - Verify category mapping in ticket creation logic
   - Check group IDs match Sonar configuration
   - Default to General Support (ID: 49) for unknown categories

### Debug Commands

```bash
# Test customer search locally
curl -X POST http://localhost:8080/customer/search \
  -H "X-API-Key: test_local_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"phone": "618-922-6759"}'

# Test production endpoint
curl -X POST https://elevenlabs-sonar-tools.fly.dev/customer/search \
  -H "X-API-Key: your_production_key" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "8586"}'
```

### ElevenLabs Tool Debugging

1. **Check Tool Status**: Use ElevenLabs dashboard to verify tool creation
2. **Test Webhooks**: Monitor server logs during agent conversations
3. **Verify Headers**: Ensure `X-API-Key` secret is properly configured
4. **Dynamic Variables**: Check assignments map to correct response paths

## Security Considerations

- **API Keys**: Never log or expose in responses
- **Rate Limiting**: Respect Sonar's 400 req/min limit
- **Input Validation**: Use Zod schemas for all endpoints
- **Error Handling**: Return generic errors to prevent information leakage

### IP Whitelisting

The service implements comprehensive IP whitelisting to restrict access to authorized sources only:

**ElevenLabs Webhook IPs:**
- US (Default): 34.67.146.145, 34.59.11.47
- EU: 35.204.38.71, 34.147.113.54
- Asia: 35.185.187.110, 35.247.157.189

**Sonar V2 Egress IPs:**
- US Azure: 20.221.112.37, 20.221.114.13, 52.158.209.86
- Canada Azure: 20.104.33.4

**Sonar Support Access IPs:**
- Hardware/Client Equipment: 52.185.28.83
- Instance Access/Application Firewall: 20.84.183.202

**Looker SFTP IPs:**
- 34.200.64.243, 54.157.231.76, 18.206.32.254

**Development Access:**
- Local development (127.0.0.1, ::1, localhost) is allowed in non-production environments
- Health check endpoint (/healthz) is always accessible for monitoring

## Future Enhancements

1. **Caching**: Add Redis for frequently accessed customer data
2. **Webhooks**: Implement Sonar webhook listeners for real-time updates
3. **Monitoring**: Add structured logging and metrics collection
4. **Multi-tenant**: Support multiple Sonar instances
5. **GraphQL Subscriptions**: Real-time inventory status updates

## Support

For issues or questions:
1. Check server logs: `flyctl logs --app elevenlabs-sonar-tools`
2. Verify Sonar API connectivity and rate limits
3. Test individual endpoints with curl commands
4. Review ElevenLabs tool configuration and dynamic variables

---

**Last Updated**: August 21, 2025  
**Version**: 1.0.0  
**Production URL**: https://elevenlabs-sonar-tools.fly.dev
