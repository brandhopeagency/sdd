# Data Privacy & GDPR

[← Back to README](./README.md)

---

## REQ-PRIV-800: On-Screen PII Masking

**Priority**: High  
**Description**: A global toggle to mask Personally Identifiable Information in the Workbench.

**Acceptance Criteria**:
- Toggle in Workbench header (visible to all Workbench users)
- When enabled, mask:
  - Full names → "Alex C..."
  - Email addresses → "a***@***.com"
  - User IDs → "****"
  - Phone numbers → "***-***-1234"
- Masking applied client-side (PII still transmitted securely)
- State persisted in localStorage
- Default: Enabled

**Technical Notes**:
```typescript
// Masking utilities
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@***.${domain.split('.').pop()}`;
}

export function maskName(name: string): string {
  const parts = name.split(' ');
  return parts.map(p => `${p.slice(0, 4)}...`).join(' ');
}

// Context provider
const PIIMaskContext = createContext({ masked: true, toggle: () => {} });
```

---

## REQ-PRIV-801: Data Portability (Right of Access)

**Priority**: High  
**Description**: Export all data associated with a specific user.

**Acceptance Criteria**:
- "Download Archive" button in User Profile Card
- Export formats: JSON (machine-readable), CSV (tabular)
- Includes: Profile data, all sessions, all messages, feedback given
- Generated asynchronously (email notification when ready)
- Download link expires after 24 hours
- Audit log entry created

**Technical Notes**:
- API: `POST /api/admin/users/:userId/export`
- Response: `{ jobId: string, estimatedTime: number }`
- Webhook/polling for completion status

---

## REQ-PRIV-802: Right to Erasure

**Priority**: High  
**Description**: Permanently anonymize a user's data upon request.

**Acceptance Criteria**:
- "Execute Erasure" button in User Profile Card
- Requires confirmation dialog with explicit acknowledgment
- Owner role required for execution
- Actions performed:
  - Replace PII with anonymized placeholders
  - Dissociate sessions from user identity
  - Retain non-identifiable data for training purposes
  - Delete authentication credentials
- Irreversible action with audit trail
- Email confirmation to administrator

**Technical Notes**:
- API: `POST /api/admin/users/:userId/erase`
- Request body: `{ confirmationCode: string, reason: string }`
- Soft delete with anonymization, not hard delete

---

[← Back to README](./README.md) | [Next: Wireframes →](./05-wireframes.md)

