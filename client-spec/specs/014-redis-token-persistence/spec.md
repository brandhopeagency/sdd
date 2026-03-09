# Feature Specification: Shared Redis Token Persistence

**Feature Branch**: `014-redis-token-persistence`  
**Created**: 2026-02-22  
**Status**: Complete  
**Jira Epic**: [MTB-352](https://mentalhelpglobal.atlassian.net/browse/MTB-352)  
**Input**: User description: "let's make sure that auth refresh token is persisted across backend instances in a shared redis storage"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seamless Session Continuity Across Backend Instances (Priority: P1)

An authenticated user stays logged in regardless of which backend instance handles their requests. Today, if a user's refresh token is stored only in the memory of one backend instance, a subsequent request routed to a different instance (via load balancing or auto-scaling) cannot find the token, forcing the user to log in again. With shared token persistence, any backend instance can look up and validate the user's refresh token, ensuring uninterrupted sessions.

**Why this priority**: This is the core problem — users being unexpectedly logged out due to token loss during instance routing is the primary pain point and the main reason for this feature.

**Independent Test**: Can be fully tested by authenticating a user, then verifying the refresh token is retrievable from any backend instance. Delivers immediate value by eliminating forced logouts during normal operation.

**Acceptance Scenarios**:

1. **Given** a user has authenticated and received a refresh token, **When** their next request is handled by a different backend instance, **Then** the system successfully validates the refresh token and issues a new access token without requiring re-authentication.
2. **Given** a user has an active session, **When** the original backend instance that issued their token is restarted or scaled down, **Then** the user's refresh token remains accessible and their session continues uninterrupted.
3. **Given** multiple backend instances are running, **When** a user authenticates, **Then** the issued refresh token is immediately available to all instances.

---

### User Story 2 - Session Survival Across Backend Deployments (Priority: P2)

When the backend is redeployed or restarted (e.g., during a rolling update), users with active sessions are not forced to re-authenticate. Their refresh tokens survive the deployment because they are stored externally rather than in process memory.

**Why this priority**: Deployments happen regularly; losing all user sessions on every deploy degrades user experience and increases support load. This story builds on US1 but specifically addresses the deployment lifecycle.

**Independent Test**: Can be tested by authenticating a user, restarting all backend instances, and verifying the user can still use their refresh token to obtain a new access token.

**Acceptance Scenarios**:

1. **Given** a user has an active session with a valid refresh token, **When** all backend instances are restarted simultaneously, **Then** the user can still refresh their access token after the restart without re-authenticating.
2. **Given** a rolling deployment is in progress, **When** instances are replaced one by one, **Then** no authenticated user loses their session during the transition.

---

### User Story 3 - Graceful Degradation on Storage Unavailability (Priority: P3)

If the shared token storage becomes temporarily unavailable, the system handles the situation gracefully rather than crashing or silently failing. Users receive clear feedback and the system recovers automatically when storage connectivity is restored.

**Why this priority**: Resilience against storage outages is important for production reliability, but it is a secondary concern compared to the core persistence capability.

**Independent Test**: Can be tested by simulating a storage outage (e.g., disconnecting the shared store) and verifying the system responds with appropriate error handling and recovers when connectivity is restored.

**Acceptance Scenarios**:

1. **Given** the shared token storage is temporarily unreachable, **When** a user attempts to refresh their access token, **Then** the system returns an appropriate authentication error rather than an unhandled server error.
2. **Given** the shared token storage was temporarily unavailable, **When** connectivity is restored, **Then** the system automatically resumes normal token operations without manual intervention.
3. **Given** the shared token storage is unavailable, **When** a new user authenticates, **Then** the system informs the user that login is temporarily unavailable rather than issuing a token that cannot be persisted.

---

### Edge Cases

- What happens when the shared storage reaches its memory limit? The system should evict expired tokens first and reject new token storage with appropriate errors if capacity is exhausted.
- What happens when a refresh token exists in shared storage but has expired? The system should reject it and prompt re-authentication, and clean up expired tokens periodically.
- What happens if two backend instances attempt to refresh the same token simultaneously (race condition)? Only one refresh should succeed; the other should receive an appropriate error or retry.
- What happens during migration from the current storage mechanism to shared storage? Existing sessions should either be preserved through a migration step or users should experience a one-time re-authentication during the transition.
- What happens when network latency to the shared store causes slow token lookups? The system should enforce a timeout and fail gracefully rather than blocking indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store all newly issued refresh tokens in a shared, network-accessible storage that is readable by every backend instance.
- **FR-002**: System MUST validate refresh tokens by looking them up in shared storage, regardless of which backend instance originally issued the token.
- **FR-003**: System MUST remove refresh tokens from shared storage when they are revoked (e.g., user logout, password change, admin revocation).
- **FR-004**: System MUST automatically expire refresh tokens in shared storage based on the configured token lifetime, preventing indefinite accumulation.
- **FR-005**: System MUST handle shared storage unavailability gracefully, returning appropriate authentication errors rather than crashing or hanging.
- **FR-006**: System MUST recover token operations automatically when shared storage connectivity is restored, without requiring a manual restart.
- **FR-007**: System MUST support concurrent token operations from multiple backend instances without data corruption or race conditions.
- **FR-008**: System MUST enforce a timeout on shared storage operations to prevent request blocking when the store is slow or unresponsive.

### Key Entities

- **Refresh Token**: A credential issued upon successful authentication that allows a client to obtain new access tokens. Key attributes: token identifier, associated user identifier, expiration timestamp, issued-at timestamp, revocation status.
- **Token Store**: The shared persistence layer accessible by all backend instances. Holds refresh tokens keyed by token identifier with automatic expiration support.

## Assumptions

- The application already uses a refresh-token-based authentication flow; this feature changes where tokens are stored, not how authentication works.
- A shared storage service (Redis or equivalent) is available or will be provisioned as part of this feature's infrastructure setup.
- Backend instances are stateless or will become stateless with respect to authentication tokens after this change.
- Token rotation (issuing a new refresh token on each use) is handled at the application level and is orthogonal to the storage mechanism.
- Environment-specific storage connection details will be managed through existing environment configuration mechanisms.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero users experience forced logouts due to their request being routed to a different backend instance under normal operating conditions.
- **SC-002**: Zero user sessions are lost during a standard backend deployment (rolling update or full restart).
- **SC-003**: Token refresh operations complete within 500 milliseconds under normal load, ensuring no perceptible delay for users.
- **SC-004**: When shared storage is unavailable, 100% of token-related requests return a well-defined error within 3 seconds (no indefinite hangs or unhandled crashes).
- **SC-005**: After shared storage connectivity is restored, the system resumes normal token operations within 30 seconds without manual intervention.
