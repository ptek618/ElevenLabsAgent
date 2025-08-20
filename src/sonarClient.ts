import fetch from 'node-fetch';
import { TokenBucket, normalizePhoneForSonar } from './utils';
import { ApiError } from './types';

export class SonarClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  protected readonly rateLimiter: TokenBucket;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    const isTest = process.env.NODE_ENV === 'test';
    this.rateLimiter = new TokenBucket(isTest ? 1000 : 5, isTest ? 1000 : 5);
  }

  public async makeRequest(query: string, variables?: any, retries = 2): Promise<any> {
    if (!this.rateLimiter.consume()) {
      throw new Error('Rate limit exceeded');
    }

    const body = JSON.stringify({ query, variables });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        timeout: 30000,
      });

      if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.makeRequest(query, variables, retries - 1);
      }

      if (response.status === 401) {
        const error: ApiError = {
          ok: false,
          code: 'SONAR_AUTH_ERROR',
          message: 'Invalid Sonar API key',
        };
        throw error;
      }

      if (response.status !== 200) {
        const error: ApiError = {
          ok: false,
          code: 'SONAR_API_ERROR',
          message: `Sonar API returned status ${response.status}`,
        };
        throw error;
      }

      const responseBody = await response.json() as any;

      if (responseBody.errors) {
        const error: ApiError = {
          ok: false,
          code: 'SONAR_GRAPHQL_ERROR',
          message: 'GraphQL errors in response',
          details: responseBody.errors,
        };
        throw error;
      }

      return responseBody.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        const timeoutError: ApiError = {
          ok: false,
          code: 'SONAR_TIMEOUT',
          message: 'Request to Sonar API timed out',
        };
        throw timeoutError;
      }
      throw error;
    }
  }

  async searchAccounts(filter: {
    name?: string;
    accountNumber?: string;
    address?: string;
    phone?: string;
    email?: string;
  }): Promise<any> {
    let query: string;
    let variables: any = {};

    if (filter.accountNumber) {
      query = `
        query SearchAccountsById($accountId: Int64Bit!) {
          accounts(id: $accountId) {
            entities {
              id
              name
              addresses {
                entities {
                  line1
                  line2
                  city
                  zip
                  type
                }
              }
              emails {
                entities {
                  email_address
                }
              }
            }
          }
        }
      `;
      variables.accountId = parseInt(filter.accountNumber);
    } else if (filter.name) {
      query = `
        query SearchAccountsByName($generalSearch: String!) {
          accounts(general_search: $generalSearch) {
            entities {
              id
              name
              addresses {
                entities {
                  line1
                  line2
                  city
                  zip
                  type
                }
              }
              emails {
                entities {
                  email_address
                }
              }
            }
          }
        }
      `;
      variables.generalSearch = filter.name;
    } else if (filter.address) {
      query = `
        query SearchAccountsByAddress($generalSearch: String!) {
          accounts(general_search: $generalSearch) {
            entities {
              id
              name
              addresses {
                entities {
                  line1
                  line2
                  city
                  zip
                  type
                }
              }
              emails {
                entities {
                  email_address
                }
              }
            }
          }
        }
      `;
      variables.generalSearch = filter.address;
    } else if (filter.phone) {
      query = `
        query SearchAccountsByPhone($phoneNumber: String!) {
          phone_numbers(general_search: $phoneNumber) {
            entities {
              id
              number
              number_formatted
              contact {
                id
                name
                contactable_id
                contactable_type
                contactable {
                  ... on Account {
                    id
                    name
                    addresses {
                      entities {
                        line1
                        line2
                        city
                        zip
                        type
                      }
                    }
                    emails {
                      entities {
                        email_address
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      variables.phoneNumber = normalizePhoneForSonar(filter.phone);
    } else if (filter.email) {
      query = `
        query SearchAccountsByEmail($generalSearch: String!) {
          accounts(general_search: $generalSearch) {
            entities {
              id
              name
              addresses {
                entities {
                  line1
                  line2
                  city
                  zip
                  type
                }
              }
              emails {
                entities {
                  email_address
                }
              }
            }
          }
        }
      `;
      variables.generalSearch = filter.email;
    } else {
      query = `
        query SearchAccounts {
          accounts {
            entities {
              id
              name
              addresses {
                entities {
                  line1
                  line2
                  city
                  zip
                  type
                }
              }
              emails {
                entities {
                  email_address
                }
              }
            }
          }
        }
      `;
    }

    return this.makeRequest(query, Object.keys(variables).length > 0 ? variables : undefined);
  }

  async getAccountFinancials(accountId: string): Promise<any> {
    const query = `
      query GetAccountFinancials($accountId: Int64Bit!) {
        accounts(id: $accountId) {
          entities {
            id
            name
            is_delinquent
            account_services {
              entities {
                service {
                  name
                }
              }
            }
            invoices(paginator:{page:1, records_per_page:10}, sorter:[{attribute:created_at, direction:DESC}]) {
              entities {
                id
                remaining_due
                total_debits
                total_taxes
                created_at
              }
            }
            payments(paginator:{page:1, records_per_page:5}, sorter:[{attribute:created_at, direction:DESC}]) {
              entities {
                id
                amount
                created_at
                payment_type
                reference
              }
            }
          }
        }
      }
    `;

    return this.makeRequest(query, { accountId: parseInt(accountId) });
  }

  async getAccountNotes(accountId: string, limit = 10, since?: string): Promise<any> {
    const query = `
      query GetAccountNotes($accountId: Int64Bit!) {
        accounts(id: $accountId) {
          entities {
            id
            notes {
              entities {
                id
                created_at
                message
                user {
                  name
                }
              }
            }
          }
        }
      }
    `;

    return this.makeRequest(query, { accountId: parseInt(accountId) });
  }

  async createTicket(input: {
    accountId: string;
    title: string;
    body: string;
    priority?: string;
    category?: string;
  }): Promise<any> {
    const mutation = `
      mutation CreateInternalTicket($input: CreateInternalTicketMutationInput!) {
        createInternalTicket(input: $input) {
          id
          sonar_unique_id
          status
          created_at
        }
      }
    `;

    const mutationInput = {
      subject: input.title,
      description: input.body,
      ticketable_type: 'Account',
      ticketable_id: parseInt(input.accountId),
      priority: input.priority ? input.priority.toUpperCase() : 'MEDIUM',
      status: 'OPEN',
      user_id: 1
    };

    return this.makeRequest(mutation, { input: mutationInput });
  }

  async getAccountInventory(accountId: string): Promise<any> {
    const query = `
      query GetAccountInventory($accountId: Int64Bit!) {
        accounts(id: $accountId) {
          entities {
            id
            name
            account_services {
              entities {
                id
                inventory_items {
                  entities {
                    id
                    inventory_model {
                      id
                      name
                      model_name
                      device_type
                      manufacturer {
                        name
                      }
                    }
                    overall_status
                    icmp_device_status
                    snmp_device_status
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.makeRequest(query, { accountId: parseInt(accountId) });
  }

  async introspectSchema(): Promise<any> {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            fields {
              name
              type {
                name
              }
            }
          }
        }
      }
    `;

    return this.makeRequest(query);
  }
}
