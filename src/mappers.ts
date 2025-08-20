import { normalizePhoneToE164, deriveDeviceStatus } from './utils';
import {
  CustomerSearchResponse,
  CustomerFinancialsResponse,
  CustomerNotesResponse,
  TicketCreateResponse,
  CustomerInventoryResponse,
} from './types';

export function mapAccountSearchResponse(
  data: any,
  searchType: 'name' | 'accountNumber' | 'address' | 'phone' | 'email'
): CustomerSearchResponse {
  let accounts: any[] = [];
  
  if (searchType === 'phone') {
    const phoneNumbers = data?.phone_numbers?.entities || [];
    accounts = phoneNumbers
      .filter((pn: any) => pn.contact?.contactable_type === 'Account' && pn.contact?.contactable)
      .map((pn: any) => pn.contact.contactable);
  } else {
    accounts = data?.accounts?.entities || [];
  }
  
  if (accounts.length === 0) {
    return {
      matchType: searchType,
      exact: false,
      customer: null,
      candidates: [],
    };
  }

  const primaryAccount = accounts[0];
  const candidates = accounts.slice(1).map((account: any) => ({
    id: account.id,
    name: account.name,
    accountNumber: account.id,
    address: account.addresses?.entities?.[0] ? 
      `${account.addresses.entities[0].line1}, ${account.addresses.entities[0].city} ${account.addresses.entities[0].zip}` : '',
    phone: '',
    email: account.emails?.entities?.[0]?.email_address || '',
  }));

  return {
    matchType: searchType,
    exact: accounts.length === 1,
    customer: {
      id: primaryAccount.id,
      accountNumber: primaryAccount.id,
      name: primaryAccount.name,
      primaryPhone: '',
      emails: primaryAccount.emails?.entities?.map((e: any) => e.email_address) || [],
      serviceAddress: primaryAccount.addresses?.entities?.[0] ? 
        `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
      billingAddress: primaryAccount.addresses?.entities?.[0] ? 
        `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
    },
    candidates,
  };
}

export function mapAccountFinancialsResponse(data: any, accountId: string): CustomerFinancialsResponse {
  const accounts = data?.accounts?.entities || [];
  const account = accounts.find((acc: any) => acc.id === accountId) || accounts[0];
  
  if (!account) {
    throw new Error('Account not found');
  }

  const invoices = account.invoices?.entities || [];
  const rawBalance = invoices
    .filter((invoice: any) => (invoice.remaining_due || 0) > 0)
    .reduce((sum: number, invoice: any) => sum + (invoice.remaining_due || 0), 0);
  
  const currentBalance = rawBalance > 1000 && rawBalance % 100 === 0 ? rawBalance / 100 : rawBalance;
  
  const services = account.account_services?.entities || [];
  const billingPlan = services.length > 0 ? services[0].service?.name || 'Unknown' : 'Unknown';
  
  const isDelinquent = account.is_delinquent || false;

  const payments = account.payments?.entities || [];
  const lastPayment = payments.length > 0 ? payments[0] : null;

  return {
    accountId: account.id,
    currentBalance: currentBalance,
    billingPlan: billingPlan,
    isDelinquent: isDelinquent,
    lastPayment: lastPayment ? {
      date: lastPayment.created_at,
      amount: (() => {
        const rawAmount = lastPayment.amount || 0;
        return rawAmount > 1000 && rawAmount % 100 === 0 ? rawAmount / 100 : rawAmount;
      })(),
      method: lastPayment.payment_type,
      reference: lastPayment.reference,
    } : null,
  };
}

export function mapAccountNotesResponse(data: any, accountId: string): CustomerNotesResponse {
  const accounts = data?.accounts?.entities || [];
  const account = accounts.find((acc: any) => acc.id === accountId);
  
  if (!account) {
    throw new Error('Account not found');
  }

  const notes = account.notes?.entities || [];

  return {
    accountId: account.id,
    notes: notes.map((note: any) => ({
      id: note.id,
      createdAt: note.created_at,
      author: note.user?.name || 'Unknown',
      text: note.message,
    })),
  };
}

export function mapTicketCreateResponse(data: any): TicketCreateResponse {
  const result = data?.createInternalTicket;
  if (!result) {
    throw new Error('Invalid ticket creation response');
  }

  return {
    ticketId: result.id,
    ticketNumber: result.sonar_unique_id,
    status: result.status,
  };
}

export function mapAccountInventoryResponse(data: any, accountId: string): CustomerInventoryResponse {
  const accounts = data?.accounts?.entities || [];
  const account = accounts.find((acc: any) => acc.id === accountId) || accounts[0];
  
  if (!account) {
    throw new Error('Account not found');
  }

  const addresses = account.addresses?.entities || [];
  const inventory: any[] = [];

  addresses.forEach((address: any) => {
    const inventoryItems = address.inventory_items?.entities || [];
    inventoryItems.forEach((item: any) => {
      const model = item.inventory_model;
      let status = 'unknown';
      
      if (item.overall_status) {
        status = item.overall_status.toLowerCase();
      } else if (item.icmp_device_status === 'UP') {
        status = 'online';
      } else if (item.icmp_device_status === 'DOWN') {
        status = 'offline';
      }
      
      inventory.push({
        id: item.id,
        type: model?.device_type || 'Unknown',
        model: model?.model_name || model?.name || 'N/A',
        mac: 'N/A',
        serial: 'N/A',
        status: status,
        icmpDeviceStatus: item.icmp_device_status || 'UNKNOWN',
      });
    });
  });

  return {
    accountId: account.id,
    inventory,
  };
}
