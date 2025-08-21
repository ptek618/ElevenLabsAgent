import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { validateApiKey } from './auth';
import { healthCheck } from './health';
import { SonarClient } from './sonarClient';
import { normalizePhoneToE164 } from './utils';
import {
  customerSearchSchema,
  customerFinancialsSchema,
  customerNotesSchema,
  ticketCreateSchema,
  customerInventorySchema,
} from './validators';
import {
  mapAccountSearchResponse,
  mapAccountFinancialsResponse,
  mapAccountNotesResponse,
  mapTicketCreateResponse,
  mapAccountInventoryResponse,
} from './mappers';
import { ApiError } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const sonarClient = new SonarClient(
  process.env.SONAR_API_URL!,
  process.env.SONAR_API_KEY!
);

const WHITELISTED_IPS = [
  '34.67.146.145',   // US (Default)
  '34.59.11.47',     // US (Default)
  '35.204.38.71',    // EU
  '34.147.113.54',   // EU
  '35.185.187.110',  // Asia
  '35.247.157.189',  // Asia
  '20.221.112.37',   // US Azure egress
  '20.221.114.13',   // US Azure egress
  '52.158.209.86',   // US Azure egress
  '20.104.33.4',     // Canada Azure ingress/egress
  '52.185.28.83',    // Hardware/Client Equipment access
  '20.84.183.202',   // Instance Access/Application Firewall
  '34.200.64.243',
  '54.157.231.76',
  '18.206.32.254'
];

const ipWhitelist = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === '/healthz') {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  
  const realIP = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIP;
  
  if (process.env.NODE_ENV !== 'production' && 
      (realIP === '127.0.0.1' || realIP === '::1' || realIP?.includes('localhost'))) {
    return next();
  }
  
  if (realIP && WHITELISTED_IPS.includes(realIP)) {
    return next();
  }
  
  console.warn(`Blocked request from unauthorized IP: ${realIP}`);
  return res.status(403).json({ 
    ok: false, 
    code: 'FORBIDDEN', 
    message: 'Access denied: IP not whitelisted' 
  });
};

app.use(helmet());
app.use(cors());
app.set('trust proxy', true); // Trust proxy for accurate IP detection
app.use(morgan('combined', {
  skip: (req: any) => req.url === '/healthz'
}));
app.use(express.json({ limit: '10mb' }));

app.use(ipWhitelist);

app.get('/healthz', healthCheck);

const cleanSearchRequest = (req: any, res: any, next: any) => {
  if (req.body && typeof req.body === 'object') {
    const { name, accountNumber, address, phone, email } = req.body;
    const fields = [
      { key: 'accountNumber', value: accountNumber },
      { key: 'name', value: name },
      { key: 'phone', value: phone },
      { key: 'email', value: email },
      { key: 'address', value: address }
    ].filter(field => field.value !== undefined && field.value !== null && field.value !== '');

    if (fields.length > 1) {
      const prioritizedField = fields[0];
      req.body = { [prioritizedField.key]: prioritizedField.value };
    }
  }
  next();
};

app.post('/customer/search', validateApiKey, cleanSearchRequest, async (req, res) => {
  try {
    const validatedData = customerSearchSchema.parse(req.body);
    
    let searchType: 'name' | 'accountNumber' | 'address' | 'phone' | 'email';
    let searchValue: string;
    let filter: any = {};

    if (validatedData.name) {
      searchType = 'name';
      searchValue = validatedData.name;
      filter.name = searchValue;
    } else if (validatedData.accountNumber) {
      searchType = 'accountNumber';
      searchValue = validatedData.accountNumber;
      filter.accountNumber = searchValue;
    } else if (validatedData.address) {
      searchType = 'address';
      searchValue = validatedData.address;
      filter.address = searchValue;
    } else if (validatedData.phone) {
      searchType = 'phone';
      searchValue = normalizePhoneToE164(validatedData.phone);
      filter.phone = searchValue;
    } else if (validatedData.email) {
      searchType = 'email';
      searchValue = validatedData.email;
      filter.email = searchValue;
    } else {
      const error: ApiError = {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'Exactly one search field must be provided (name, accountNumber, address, phone, or email)',
      };
      return res.status(400).json(error);
    }

    const data = await sonarClient.searchAccounts(filter);
    const response = mapAccountSearchResponse(data, searchType);
    
    res.json(response);
  } catch (error) {
    console.error('Customer search error:', error);
    
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const apiError: ApiError = {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'Validation failed',
        details: (error as any).errors,
      };
      return res.status(400).json(apiError);
    }
    
    if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
      const apiError = error as ApiError;
      return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
    }
    
    const apiError: ApiError = {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(apiError);
  }
});

app.post('/customer/financials', validateApiKey, async (req, res) => {
  try {
    const validatedData = customerFinancialsSchema.parse(req.body);
    
    const data = await sonarClient.getAccountFinancials(validatedData.accountId);
    const response = mapAccountFinancialsResponse(data, validatedData.accountId);
    
    res.json(response);
  } catch (error) {
    console.error('Customer financials error:', error);
    
    if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
      const apiError = error as ApiError;
      return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
    }
    
    const apiError: ApiError = {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(apiError);
  }
});

app.post('/customer/notes', validateApiKey, async (req, res) => {
  try {
    const validatedData = customerNotesSchema.parse(req.body);
    
    const data = await sonarClient.getAccountNotes(
      validatedData.accountId,
      validatedData.limit,
      validatedData.since
    );
    const response = mapAccountNotesResponse(data, validatedData.accountId);
    
    res.json(response);
  } catch (error) {
    console.error('Customer notes error:', error);
    
    if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
      const apiError = error as ApiError;
      return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
    }
    
    const apiError: ApiError = {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(apiError);
  }
});

app.post('/ticket/create', validateApiKey, async (req, res) => {
  try {
    const validatedData = ticketCreateSchema.parse(req.body);
    
    const data = await sonarClient.createTicket(validatedData);
    const response = mapTicketCreateResponse(data);
    
    res.json(response);
  } catch (error) {
    console.error('Ticket create error:', error);
    
    if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
      const apiError = error as ApiError;
      return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
    }
    
    const apiError: ApiError = {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(apiError);
  }
});

app.post('/customer/inventory', validateApiKey, async (req, res) => {
  try {
    const validatedData = customerInventorySchema.parse(req.body);
    
    const data = await sonarClient.getAccountInventory(validatedData.accountId);
    const response = mapAccountInventoryResponse(data, validatedData.accountId);
    
    res.json(response);
  } catch (error) {
    console.error('Customer inventory error:', error);
    
    if (error && typeof error === 'object' && 'ok' in error && 'code' in error) {
      const apiError = error as ApiError;
      return res.status(apiError.code === 'SONAR_AUTH_ERROR' ? 401 : 500).json(apiError);
    }
    
    const apiError: ApiError = {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    res.status(500).json(apiError);
  }
});

app.use((req, res) => {
  const error: ApiError = {
    ok: false,
    code: 'NOT_FOUND',
    message: 'Endpoint not found',
  };
  res.status(404).json(error);
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  const apiError: ApiError = {
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
  res.status(500).json(apiError);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
