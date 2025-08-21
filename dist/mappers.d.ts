import { CustomerSearchResponse, CustomerFinancialsResponse, CustomerNotesResponse, TicketCreateResponse, CustomerInventoryResponse } from './types';
export declare function mapAccountSearchResponse(data: any, searchType: 'name' | 'accountNumber' | 'address' | 'phone' | 'email'): CustomerSearchResponse;
export declare function mapAccountFinancialsResponse(data: any, accountId: string): CustomerFinancialsResponse;
export declare function mapAccountNotesResponse(data: any, accountId: string): CustomerNotesResponse;
export declare function mapTicketCreateResponse(data: any): TicketCreateResponse;
export declare function mapAccountInventoryResponse(data: any, accountId: string): CustomerInventoryResponse;
//# sourceMappingURL=mappers.d.ts.map