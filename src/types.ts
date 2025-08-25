export interface CustomerSearchRequest {
  name?: string;
  accountNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CustomerSearchResponse {
  matchType: 'name' | 'accountNumber' | 'address' | 'phone' | 'email';
  exact: boolean;
  customer: {
    id: string;
    accountNumber: string;
    name: string;
    primaryPhone: string;
    emails: string[];
    serviceAddress: string;
    billingAddress: string;
  } | null;
  candidates: Array<{
    id: string;
    name: string;
    accountNumber: string;
    address: string;
    phone: string;
    email: string;
  }>;
}

export interface CustomerFinancialsRequest {
  accountId: string;
}

export interface CustomerFinancialsResponse {
  accountId: string;
  currentBalance: number;
  billingPlan: string;
  isDelinquent: boolean;
  lastPayment: {
    date: string;
    amount: number;
    method: string;
    reference: string;
  } | null;
}

export interface CustomerNotesRequest {
  accountId: string;
  limit?: number;
  since?: string;
}

export interface CustomerNotesResponse {
  accountId: string;
  notes: Array<{
    id: string;
    createdAt: string;
    author: string;
    text: string;
  }>;
}

export interface TicketCreateRequest {
  accountId: string;
  title: string;
  body: string;
  priority?: string;
  category?: string;
}

export interface TicketCreateResponse {
  ticketId: string;
  ticketNumber: string;
  status: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface CustomerInventoryRequest {
  accountId: string;
}

export interface CustomerInventoryResponse {
  accountId: string;
  inventory: Array<{
    id: string;
    type: string;
    model: string;
    mac: string;
    serial: string;
    status: 'online' | 'offline' | 'unknown';
    icmpDeviceStatus: string;
  }>;
}

export interface WifiCredentialsRequest {
  account_id?: string;
  phone?: string;
  email?: string;
  name?: string;
}

export interface WifiCredentialsResponse {
  found: boolean;
  account_id?: string;
  job_id?: string;
  job_type_id?: number;
  job_datetime?: string;
  ssid?: string;
  wpa_key?: string;
  source_fields?: Array<{
    key: string;
    value: string;
  }>;
  parsing_method?: string;
  notes?: string;
  reason?: 'no_install_job' | 'no_custom_fields' | 'not_found' | 'ambiguous_account' | 'auth_error' | 'graphql_error';
  details?: string;
  candidates?: Array<{
    account_id: string;
    name: string;
  }>;
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  details?: any;
}
