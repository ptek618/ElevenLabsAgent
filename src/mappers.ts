import { normalizePhoneToE164, deriveDeviceStatus, parseWifiCredentials } from './utils';
import {
  CustomerSearchResponse,
  CustomerFinancialsResponse,
  CustomerNotesResponse,
  TicketCreateResponse,
  CustomerInventoryResponse,
  WifiCredentialsResponse,
} from './types';

export function mapAccountSearchResponse(
  data: any,
  searchType: 'name' | 'accountNumber' | 'address' | 'phone' | 'email'
): CustomerSearchResponse {
  let accounts: any[] = [];
  let phoneNumberData: any = null;
  
  if (searchType === 'phone') {
    const phoneNumbers = data?.phone_numbers?.entities || [];
    phoneNumberData = phoneNumbers.find((pn: any) => pn.contact?.contactable_type === 'Account' && pn.contact?.contactable);
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

  
  let primaryPhone = '';
  if (searchType === 'phone' && phoneNumberData) {
    primaryPhone = phoneNumberData.number_formatted || phoneNumberData.number || '';
  }
  
  const sortedAccounts = accounts.sort((a: any, b: any) => {
    const statusA = a.account_status_id || a.account_status?.id || 0;
    const statusB = b.account_status_id || b.account_status?.id || 0;
    
    if (statusA === 1 && statusB !== 1) return -1;
    if (statusA !== 1 && statusB === 1) return 1;
    return statusA - statusB;
  });

  const primaryAccount = sortedAccounts[0];
  
  const candidates = sortedAccounts.slice(1).map((account: any) => ({
    id: account.id,
    name: account.name,
    accountNumber: account.id,
    address: account.addresses?.entities?.[0] ? 
      `${account.addresses.entities[0].line1}, ${account.addresses.entities[0].city} ${account.addresses.entities[0].zip}` : '',
    phone: '',
    email: account.emails?.entities?.[0]?.email_address || '',
    accountStatus: account.account_status_id || account.account_status?.id || 0,
    accountStatusName: account.account_status?.name || 'Unknown',
  }));

  return {
    matchType: searchType,
    exact: accounts.length === 1,
    customer: {
      id: primaryAccount.id,
      accountNumber: primaryAccount.id,
      name: primaryAccount.name,
      primaryPhone: primaryPhone,
      emails: primaryAccount.emails?.entities?.map((e: any) => e.email_address) || [],
      serviceAddress: primaryAccount.addresses?.entities?.[0] ? 
        `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
      billingAddress: primaryAccount.addresses?.entities?.[0] ? 
        `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
      accountStatus: primaryAccount.account_status_id || primaryAccount.account_status?.id || 0,
      accountStatusName: primaryAccount.account_status?.name || 'Unknown',
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
  const currentBalance = invoices
    .filter((invoice: any) => (invoice.remaining_due || 0) > 0)
    .reduce((sum: number, invoice: any) => sum + (invoice.remaining_due || 0), 0) / 100;
  
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
      amount: (lastPayment.amount || 0) / 100,
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

export function mapAccountInstallJobsResponse(data: any, accountId: string): WifiCredentialsResponse {
  const accounts = data?.accounts?.entities || [];
  const account = accounts.find((acc: any) => acc.id === accountId) || accounts[0];
  
  if (!account) {
    return {
      found: false,
      reason: 'not_found',
      details: 'Account not found'
    };
  }

  const jobs = account.jobs?.entities || [];
  
  const installJobs = jobs.filter((job: any) => job.job_type?.id === 2 || job.job_type?.id === '2');
  
  if (installJobs.length === 0) {
    return {
      found: false,
      reason: 'no_install_job',
      details: 'No fiber install jobs (Job Type ID 2) found for this account'
    };
  }

  const sortedJobs = installJobs.sort((a: any, b: any) => {
    const getJobDate = (job: any) => {
      return job.completed_at || job.started_at || job.scheduled_at;
    };
    
    const dateA = new Date(getJobDate(a)).getTime();
    const dateB = new Date(getJobDate(b)).getTime();
    
    return dateB - dateA; // Most recent first
  });

  const mostRecentJob = sortedJobs[0];
  
  const customFieldDataEntities = mostRecentJob.custom_field_data?.entities || [];
  
  const customFieldData = customFieldDataEntities.map((entity: any) => ({
    key: entity.custom_field?.name || 'unknown',
    value: entity.value || ''
  }));
  
  const allCustomData = {
    custom_field_data: customFieldData,
    custom_field_data_1: null,
    custom_field_data_2: null
  };

  const parsed = parseWifiCredentials(allCustomData);
  
  if (!parsed.ssid && !parsed.wpa_key) {
    return {
      found: false,
      reason: 'no_custom_fields',
      details: 'No Wi-Fi credentials found in custom field data',
      account_id: account.id,
      job_id: mostRecentJob.id,
      job_type_id: 2,
      job_datetime: mostRecentJob.completed_at || mostRecentJob.started_at || mostRecentJob.scheduled_at,
      source_fields: parsed.source_fields
    };
  }

  return {
    found: true,
    account_id: account.id,
    job_id: mostRecentJob.id,
    job_type_id: 2,
    job_datetime: mostRecentJob.completed_at || mostRecentJob.started_at || mostRecentJob.scheduled_at,
    ssid: parsed.ssid,
    wpa_key: parsed.wpa_key,
    source_fields: parsed.source_fields,
    parsing_method: parsed.parsing_method,
    notes: 'Parsed from latest Job Type 2; delimiters supported (: , - |)'
  };
}
