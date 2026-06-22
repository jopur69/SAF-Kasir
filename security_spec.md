# Security Specification: SAF Kasir

This document outlines the zero-trust data invariants and security specifications for the SAF Kasir Firestore database.

## 1. Data Invariants
1. **User Ownership**: A shop's products, transactions, debts, and expenses belong strictly to that shop owner's account (`userId`). No user may view or modify another store's ledger.
2. **Username Uniqueness**: Each username mapped to a user must be unique to prevent identity spoofing.
3. **Superadmin Authority**: Only a verified Superadmin account (`admin@kasirpintar.com`) can manage registration limits (device activation, expiry dates, suspended state).
4. **Tenant Isolation**: Non-admin users cannot access the global registered users directory or configuration profiles of other tenants.

## 2. The "Dirty Dozen" Malicious Payloads (Unauthorized Scenarios)
1. **Unauthenticated Read on Product Catalog**: Attempt to list `/users/user-123/products` without a valid token (should fail: `unauthenticated`).
2. **Cross-Tenant Product Injection**: Attacker on `user-abc` trying to create a product inside `user-def` catalog (should fail: `not owner`).
3. **Privilege Escalation on User Profile**: A standard store owner attempting to change their `status` to `active` or extend their trial `expiryDate` directly in `/registered_users` details (should fail: `admin only`).
4. **PII Username Hijacking**: Attempt to overwrite another user's unique username mapping in `/usernames/budi` (should fail: `not owner`).
5. **Orphaned Transaction Record**: Attempt to insert a transaction with a massive description or negative bill amounts (should fail: `validation fails`).
6. **Denial of Wallet Recursion**: Injecting a massive doc ID with over 1000 characters to bloat database indexes (should fail: `isValidId`).
7. **Bypassing Suspension**: A suspended user attempting to record sales while being blacklisted (should fail: `restricted access`).
8. **Direct Superadmin Credential Tampering**: Unauthenticated write to `/config/superadmin` (should fail: `unauthenticated`).
9. **Tampering with audit trails**: Trying to modify `createdAt` or `dateCreated` fields downstream (should fail: `immutable field`).
10. **Malicious Negative Debt Entry**: Attempt to inject custom negative amounts in a customer debt register (should fail: `validation fails`).
11. **Superadmin Impersonation**: Attacker claiming to be `admin@kasirpintar.com` without proper credentials (should fail: `unauthenticated`).
12. **PII Collection Scanning**: Blanket read on `/usernames` list to scrape all user emails (should fail: `blanket read`).

## 3. Security Rules Outline
The Rules must enforce:
- `isOwner(userId)` for `/users/{userId}/**` paths.
- Admin privilege verification for `/registered_users/**` and `/config/superadmin` edits.
- Schema verification for documents (ensuring integers are positive, and fields have maximum sizes).
