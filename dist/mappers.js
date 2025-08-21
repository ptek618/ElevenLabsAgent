"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAccountSearchResponse = mapAccountSearchResponse;
exports.mapAccountFinancialsResponse = mapAccountFinancialsResponse;
exports.mapAccountNotesResponse = mapAccountNotesResponse;
exports.mapTicketCreateResponse = mapTicketCreateResponse;
exports.mapAccountInventoryResponse = mapAccountInventoryResponse;
function mapAccountSearchResponse(data, searchType) {
    let accounts = [];
    let phoneNumberData = null;
    if (searchType === 'phone') {
        const phoneNumbers = data?.phone_numbers?.entities || [];
        phoneNumberData = phoneNumbers.find((pn) => pn.contact?.contactable_type === 'Account' && pn.contact?.contactable);
        accounts = phoneNumbers
            .filter((pn) => pn.contact?.contactable_type === 'Account' && pn.contact?.contactable)
            .map((pn) => pn.contact.contactable);
    }
    else {
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
    let primaryPhone = '';
    if (searchType === 'phone' && phoneNumberData) {
        primaryPhone = phoneNumberData.number_formatted || phoneNumberData.number || '';
    }
    const candidates = accounts.slice(1).map((account) => ({
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
            primaryPhone: primaryPhone,
            emails: primaryAccount.emails?.entities?.map((e) => e.email_address) || [],
            serviceAddress: primaryAccount.addresses?.entities?.[0] ?
                `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
            billingAddress: primaryAccount.addresses?.entities?.[0] ?
                `${primaryAccount.addresses.entities[0].line1}, ${primaryAccount.addresses.entities[0].city} ${primaryAccount.addresses.entities[0].zip}` : '',
        },
        candidates,
    };
}
function mapAccountFinancialsResponse(data, accountId) {
    const accounts = data?.accounts?.entities || [];
    const account = accounts.find((acc) => acc.id === accountId) || accounts[0];
    if (!account) {
        throw new Error('Account not found');
    }
    const invoices = account.invoices?.entities || [];
    const currentBalance = invoices
        .filter((invoice) => (invoice.remaining_due || 0) > 0)
        .reduce((sum, invoice) => sum + (invoice.remaining_due || 0), 0) / 100;
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
function mapAccountNotesResponse(data, accountId) {
    const accounts = data?.accounts?.entities || [];
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) {
        throw new Error('Account not found');
    }
    const notes = account.notes?.entities || [];
    return {
        accountId: account.id,
        notes: notes.map((note) => ({
            id: note.id,
            createdAt: note.created_at,
            author: note.user?.name || 'Unknown',
            text: note.message,
        })),
    };
}
function mapTicketCreateResponse(data) {
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
function mapAccountInventoryResponse(data, accountId) {
    const accounts = data?.accounts?.entities || [];
    const account = accounts.find((acc) => acc.id === accountId) || accounts[0];
    if (!account) {
        throw new Error('Account not found');
    }
    const addresses = account.addresses?.entities || [];
    const inventory = [];
    addresses.forEach((address) => {
        const inventoryItems = address.inventory_items?.entities || [];
        inventoryItems.forEach((item) => {
            const model = item.inventory_model;
            let status = 'unknown';
            if (item.overall_status) {
                status = item.overall_status.toLowerCase();
            }
            else if (item.icmp_device_status === 'UP') {
                status = 'online';
            }
            else if (item.icmp_device_status === 'DOWN') {
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
//# sourceMappingURL=mappers.js.map