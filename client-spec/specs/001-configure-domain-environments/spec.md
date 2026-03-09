# Feature Specification: Environment Domain and HTTPS Access

**Feature Branch**: `001-configure-domain-environments`  
**Created**: 2026-02-11  
**Status**: Complete
**Jira Epic**: MTB-232
**Input**: User description: "GCP infra has a mentalhelp.chat domain registered. I want the prod environment to be available under this domain, dev environment to be available under dev.mentalhelp.global subdomain, both using https only with verified certificates."

## Clarifications

### Session 2026-02-11

- Q: How should access to development UI be exposed after removing `mentalhelp.global` from scope? → A: Use `dev.mentalhelp.chat` for development UI access under the same registered domain family.
- Q: How should production access at `mentalhelp.chat` be controlled? → A: Publicly accessible to anyone over HTTPS.
- Q: How should `www.mentalhelp.chat` be handled? → A: Redirect `www.mentalhelp.chat` to canonical `mentalhelp.chat`.
- Operational record: GCP CLI provisioning script executed on 2026-02-12; core LB/certificate/DNS resources were created in project `mental-help-global-25` for `mentalhelp.chat`, `www.mentalhelp.chat`, and `dev.mentalhelp.chat`, pending full HTTPS validation after certificate activation.
- Rollback record: On 2026-02-12 all `mentalhelp.global` resources and references created during this implementation cycle were removed from active GCP configuration and infra scripts by request.
- Runtime CORS record: On 2026-02-12 Cloud Run backend services were updated so `FRONTEND_URL` matches new UI origins (`https://mentalhelp.chat` and `https://dev.mentalhelp.chat`), and preflight validation returned expected `access-control-allow-origin` headers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach Production via Official Domain (Priority: P1)

As an end user, I can open the production environment at `mentalhelp.chat` over HTTPS with a trusted certificate and no browser security warning.

**Why this priority**: Production accessibility on the primary domain is the main business requirement and user entry point.

**Independent Test**: Can be fully tested by opening `https://mentalhelp.chat` and confirming the production experience loads without certificate warnings.

**Acceptance Scenarios**:

1. **Given** production is active, **When** a user visits `https://mentalhelp.chat`, **Then** the production environment is displayed.
2. **Given** a user attempts to access production with an insecure `http://` URL, **When** the request is received, **Then** the user is forced onto the secure `https://` URL before content is shown.
3. **Given** a user visits `https://www.mentalhelp.chat`, **When** the request is received, **Then** the user is redirected to `https://mentalhelp.chat`.

---

### User Story 2 - Reach Development via Dev Subdomain (Priority: P2)

As an internal tester or developer, I can open the development environment at `dev.mentalhelp.chat` without affecting production access.

**Why this priority**: Development access is required for safe testing but is secondary to production availability.

**Independent Test**: Can be fully tested by opening `https://dev.mentalhelp.chat` and confirming the development environment loads as a separate destination.

**Acceptance Scenarios**:

1. **Given** development is active, **When** a tester visits `https://dev.mentalhelp.chat`, **Then** the development environment is displayed.
2. **Given** both environment URLs are configured, **When** either URL is opened, **Then** each URL routes to its intended environment without cross-routing.
3. **Given** a tester accesses `https://dev.mentalhelp.chat`, **When** the request is routed, **Then** the development UI is served from development frontend assets and not production assets.

---

### User Story 3 - Trusted Secure Access for Both Environments (Priority: P3)

As a user of either environment, I can access each URL with HTTPS-only transport and a certificate that browsers recognize as valid.

**Why this priority**: Trust and security are required for adoption and safe operation across both environments.

**Independent Test**: Can be fully tested in latest stable Chrome, Firefox, and Safari by checking browser security indicators for both URLs and confirming no certificate trust warning appears.

**Acceptance Scenarios**:

1. **Given** environment domains are configured, **When** users open each HTTPS URL in latest stable Chrome, Firefox, and Safari, **Then** both present as secure and trusted connections.
2. **Given** certificate status is monitored, **When** a certificate nears expiration, **Then** renewal is completed before users experience certificate trust failures.

---

### Edge Cases

- Malformed or partial host input must resolve to a user-safe failure response and must not route users into the wrong environment.
- Temporary certificate validation failures must trigger operational alerts and remediation before expiry risk affects user access.
- During DNS propagation windows, routing must remain deterministic for each hostname and not cross-route between production and development.
- Deprecated or invalid bookmarked hostnames must redirect to the canonical supported hostname where a redirect rule exists; otherwise they must fail safely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST make the production environment available at `mentalhelp.chat`.
- **FR-002**: System MUST make the development environment available at `dev.mentalhelp.chat`.
- **FR-003**: System MUST enforce HTTPS-only access for both environment URLs.
- **FR-004**: System MUST ensure each environment URL presents a currently valid, browser-trusted certificate.
- **FR-005**: System MUST prevent environment cross-routing so each URL resolves to its designated environment.
- **FR-006**: System MUST preserve user access continuity during certificate renewals so expired or untrusted certificates are not presented in normal operation.
- **FR-007**: System MUST define and document ownership responsibility for domain and certificate lifecycle management.
- **FR-008**: System MUST keep development UI isolated from production by host-based routing on `dev.mentalhelp.chat`.
- **FR-009**: System MUST allow public HTTPS access to `mentalhelp.chat` without network-based pre-restrictions.
- **FR-010**: System MUST treat `mentalhelp.chat` as the canonical production host and redirect `www.mentalhelp.chat` to it over HTTPS.

### Key Entities *(include if feature involves data)*

- **Environment Domain Mapping**: A record that links each environment name (production, development) to its public URL.
- **Certificate Record**: A record containing certificate status, validity window, and renewal ownership for each environment URL.
- **Access Policy**: A policy definition describing that only secure HTTPS access is permitted for each environment URL.

### Assumptions

- The organization has control over DNS records for `mentalhelp.chat`, `www.mentalhelp.chat`, and `dev.mentalhelp.chat`.
- Production and development environments already exist and are operational targets for routing.
- Environment stakeholders agree that plain HTTP access is not allowed for either environment.

### Scope Boundaries

- In scope: domain-to-environment availability, HTTPS-only enforcement, and trusted certificate coverage for the two specified URLs.
- Out of scope: redesigning application behavior within either environment, adding additional subdomains, or creating new runtime environments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful user sessions for the two specified URLs occur over HTTPS.
- **SC-002**: 0 user-visible certificate trust warnings are observed for `mentalhelp.chat`, `www.mentalhelp.chat`, and `dev.mentalhelp.chat` during release verification.
- **SC-003**: Users can reach the correct intended environment from each specified URL on first attempt in at least 99% of validation checks.
- **SC-004**: Domain and certificate ownership information is documented and acknowledged by responsible stakeholders before release sign-off.
