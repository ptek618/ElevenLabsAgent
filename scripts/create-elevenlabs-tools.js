const fetch = require('node-fetch');
require('dotenv').config();

const ELEVENLABS_API_KEY = process.env.FeralBullShark;
const LOCAL_TOOL_API_KEY = process.env.LOCAL_TOOL_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://your-deployed-service.com';

const TIMESTAMP = new Date().toISOString();
const ITERATION_ID = `Iteration ${TIMESTAMP}`;

if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required');
  process.exit(1);
}

const tools = [
  {
    name: 'customer_search',
    description: `Find ProTek customer by name, account number, address, or phone. Returns best match and candidates. (Updated: ${TIMESTAMP})`,
    endpoint: '/customer/search',
    assignments: [
      { source: 'response', dynamic_variable: 'customer_name', value_path: 'customer.name' },
      { source: 'response', dynamic_variable: 'account_number', value_path: 'customer.accountNumber' },
      { source: 'response', dynamic_variable: 'account_id', value_path: 'customer.id' },
      { source: 'response', dynamic_variable: 'customer_email', value_path: 'customer.emails.0' },
      { source: 'response', dynamic_variable: 'customer_phone', value_path: 'customer.primaryPhone' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Provide exactly one lookup field to search for a customer.',
      properties: {
        name: { type: 'string', description: 'Full or partial customer name to search for' },
        accountNumber: { type: 'string', description: 'Customer account number (numeric ID)' },
        address: { type: 'string', description: 'Customer service address to search for' },
        phone: { type: 'string', description: 'Customer phone number (E.164 format preferred, e.g. +16185551234)' },
        email: { type: 'string', description: 'Customer email address to search for' }
      }
    }
  },
  {
    name: 'customer_financials',
    description: `Get ProTek customer current balance, billing plan, delinquent status, and recent payment history. (Updated: ${TIMESTAMP})`,
    endpoint: '/customer/financials',
    assignments: [
      { source: 'response', dynamic_variable: 'current_balance', value_path: 'currentBalance' },
      { source: 'response', dynamic_variable: 'billing_plan', value_path: 'billingPlan' },
      { source: 'response', dynamic_variable: 'is_delinquent', value_path: 'isDelinquent' },
      { source: 'response', dynamic_variable: 'last_payment_amount', value_path: 'lastPayment.amount' },
      { source: 'response', dynamic_variable: 'last_payment_date', value_path: 'lastPayment.date' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Retrieve financial information including current balance and payment history for a customer account.',
      required: ['accountId'],
      properties: {
        accountId: { type: 'string', description: 'Customer account ID (numeric string, e.g. "9446")' }
      }
    }
  },
  {
    name: 'customer_notes',
    description: `Get ProTek customer notes and support history. (Updated: ${TIMESTAMP})`,
    endpoint: '/customer/notes',
    assignments: [
      { source: 'response', dynamic_variable: 'notes_count', value_path: 'notes.length' },
      { source: 'response', dynamic_variable: 'latest_note', value_path: 'notes.0.text' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Retrieve customer notes and support history for a customer account.',
      required: ['accountId'],
      properties: {
        accountId: { type: 'string', description: 'Customer account ID (numeric string, e.g. "9446")' },
        limit: { type: 'number', description: 'Number of notes to retrieve (max 100)', default: 10 },
        since: { type: 'string', description: 'ISO datetime to filter notes since (optional)' }
      }
    }
  },
  {
    name: 'ticket_create',
    description: `Create a new support ticket for a ProTek customer. Supports dynamic group assignment based on category. Defaults to MEDIUM priority and 'AI Generated - General Support' group. (Updated: ${TIMESTAMP})`,
    endpoint: '/ticket/create',
    assignments: [
      { source: 'response', dynamic_variable: 'ticket_id', value_path: 'ticketId' },
      { source: 'response', dynamic_variable: 'ticket_number', value_path: 'ticketNumber' },
      { source: 'response', dynamic_variable: 'ticket_status', value_path: 'status' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Create a new support ticket for a customer account with title and description. The category determines which ticket group the ticket is assigned to.',
      required: ['accountId', 'title', 'body'],
      properties: {
        accountId: { type: 'string', description: 'Customer account ID (numeric string, e.g. "9446")' },
        title: { type: 'string', description: 'Ticket title/subject line describing the issue' },
        body: { type: 'string', description: 'Detailed description of the issue or request' },
        priority: { type: 'string', description: 'Ticket priority level (low, medium, high, urgent)', default: 'medium' },
        category: { 
          type: 'string', 
          description: 'Ticket category for automatic group assignment. Options: "billing" (billing issues), "construction" (installation/construction), "no internet" (connectivity issues), "new sign up" (new customer registration), "general" (general support - default). If not specified or unrecognized, defaults to general support.',
          enum: ['billing', 'construction', 'no internet', 'new sign up', 'general'],
          default: 'general'
        }
      }
    }
  },
  {
    name: 'customer_inventory',
    description: `Get ProTek customer equipment inventory with model details and online/offline status from serviceable addresses. (Updated: ${TIMESTAMP})`,
    endpoint: '/customer/inventory',
    assignments: [
      { source: 'response', dynamic_variable: 'inventory_count', value_path: 'inventory.length' },
      { source: 'response', dynamic_variable: 'first_device_status', value_path: 'inventory.0.status' },
      { source: 'response', dynamic_variable: 'first_device_icmp_status', value_path: 'inventory.0.icmpDeviceStatus' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Retrieve equipment inventory including model numbers, MAC addresses, serial numbers, and device status for a customer account.',
      required: ['accountId'],
      properties: {
        accountId: { type: 'string', description: 'Customer account ID (numeric string, e.g. "9446")' }
      }
    }
  },
  {
    name: 'wifi_credentials_from_install',
    description: `Fetch Wi-Fi SSID and WPA key from the most recent fiber install (Job Type ID 2) for a given ProTek customer. (Updated: ${TIMESTAMP})`,
    endpoint: '/wifi/credentials',
    assignments: [
      { source: 'response', dynamic_variable: 'wifi_ssid', value_path: 'ssid' },
      { source: 'response', dynamic_variable: 'wifi_wpa_key', value_path: 'wpa_key' },
      { source: 'response', dynamic_variable: 'install_job_id', value_path: 'job_id' },
      { source: 'response', dynamic_variable: 'install_job_date', value_path: 'job_datetime' }
    ],
    request_body_schema: {
      type: 'object',
      description: 'Provide at least one lookup field to find the customer account.',
      properties: {
        account_id: { 
          type: 'string', 
          description: 'ProTek account ID if known' 
        },
        phone: { 
          type: 'string', 
          description: 'Customer phone number (E.164 preferred)' 
        },
        email: { 
          type: 'string', 
          description: 'Customer email address' 
        },
        name: { 
          type: 'string', 
          description: 'Customer full name' 
        }
      }
    }
  }
];

async function createTool(toolConfig) {
  const payload = {
    tool_config: {
      type: 'webhook',
      name: toolConfig.name,
      description: toolConfig.description,
      response_timeout_secs: 20,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: toolConfig.assignments,
      api_schema: {
        url: `${PUBLIC_BASE_URL}${toolConfig.endpoint}`,
        method: 'POST',
        request_headers: {
          'X-API-Key': 'secret__LOCAL_TOOL_API_KEY'
        },
        request_body_schema: toolConfig.request_body_schema
      }
    }
  };

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error(`Failed to create tool ${toolConfig.name}:`, result);
      return null;
    }

    console.log(`✅ Created tool: ${toolConfig.name} (ID: ${result.id})`);
    return result;
  } catch (error) {
    console.error(`Error creating tool ${toolConfig.name}:`, error.message);
    return null;
  }
}

async function createAllTools() {
  console.log('Creating ElevenLabs server tools...\n');
  
  const results = [];
  for (const tool of tools) {
    const result = await createTool(tool);
    if (result) {
      results.push(result);
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  console.log(`\n✅ Successfully created ${results.length}/${tools.length} tools`);
  
  if (results.length > 0) {
    console.log('\nTool IDs:');
    results.forEach(result => {
      console.log(`- ${result.tool_config.name}: ${result.id}`);
    });
  }

  return results;
}

if (require.main === module) {
  createAllTools().catch(console.error);
}

module.exports = { createAllTools, tools };
