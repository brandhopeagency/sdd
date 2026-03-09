# Phase 0 Research: Environment Domain and HTTPS Access

## Decision 1: Certificate management model

**Decision**: Use Google-managed certificates attached to the HTTPS load-balancing entry point for `mentalhelp.chat`, `www.mentalhelp.chat`, and `dev.mentalhelp.global`.

**Rationale**:
- Provides automatic renewal and reduces operational error risk.
- Keeps certificate lifecycle centralized in GCP infrastructure controls.
- Meets requirement for verified certificates with minimal manual handling.

**Alternatives considered**:
- Let's Encrypt automation with custom renewal jobs (rejected: higher operational burden).
- Manual certificate provisioning and rotation (rejected: high outage/expiry risk).

## Decision 2: HTTPS and canonical redirect behavior

**Decision**:
- Enforce redirect from HTTP to HTTPS for all configured hosts.
- Make `mentalhelp.chat` the canonical production host.
- Redirect `www.mentalhelp.chat` to `https://mentalhelp.chat`.

**Rationale**:
- Guarantees HTTPS-only access and eliminates duplicate production host ambiguity.
- Simplifies validation and operational support.
- Matches clarification decisions captured in `spec.md`.

**Alternatives considered**:
- Serve both apex and `www` without redirect (rejected: duplicate host behavior).
- Canonicalize to `www` instead of apex (rejected: conflicts with agreed canonical host).

## Decision 3: Development environment access control

**Decision**: Restrict `dev.mentalhelp.global` by network controls only using edge policy allowlisting.

**Rationale**:
- Directly satisfies clarification: network controls only.
- Prevents unauthorized access before requests reach development backends.
- Supports controlled internal testing while keeping production public.

**Alternatives considered**:
- Identity-based access control (rejected: violates network-only constraint).
- VPN-only private ingress (rejected: higher setup and tester friction for current scope).

## Decision 4: Domain and certificate ownership/observability

**Decision**:
- Assign explicit ownership for domain mapping and certificate lifecycle in infra docs/runbooks.
- Add scripted checks to verify certificate validity state and redirect behavior during deployments.

**Rationale**:
- Directly supports FR-006 and FR-007.
- Provides operational readiness signal before and after release.
- Reduces risk of silent certificate failures.

**Alternatives considered**:
- Ad-hoc manual checks only (rejected: insufficient repeatability/auditability).
- External-only SSL monitoring without deployment gates (rejected: weaker release protection).
