import { TokenBucket } from './utils';
export declare class SonarClient {
    private readonly apiUrl;
    private readonly apiKey;
    protected readonly rateLimiter: TokenBucket;
    constructor(apiUrl: string, apiKey: string);
    makeRequest(query: string, variables?: any, retries?: number): Promise<any>;
    searchAccounts(filter: {
        name?: string;
        accountNumber?: string;
        address?: string;
        phone?: string;
        email?: string;
    }): Promise<any>;
    getAccountFinancials(accountId: string): Promise<any>;
    getAccountNotes(accountId: string, limit?: number, since?: string): Promise<any>;
    private getCategoryGroupId;
    private mapPriorityToEnum;
    createTicket(input: {
        accountId: string;
        title: string;
        body: string;
        priority?: string;
        category?: string;
    }): Promise<any>;
    getAccountInventory(accountId: string): Promise<any>;
    getAccountInstallJobs(accountId: string): Promise<any>;
    introspectSchema(): Promise<any>;
}
//# sourceMappingURL=sonarClient.d.ts.map