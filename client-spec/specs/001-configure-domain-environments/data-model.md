# Data Model: Environment Domain and HTTPS Access

## Entity: EnvironmentDomainMapping

Represents the public hostname assignment for an environment.

### Fields

- `id` (string, required): Unique mapping identifier.
- `environment` (enum, required): `production` or `development`.
- `hostname` (string, required): Public domain or subdomain.
- `isCanonical` (boolean, required): Whether this hostname is canonical for its environment.
- `targetProfile` (string, required): Routing target profile identifier.
- `httpsOnly` (boolean, required): Must be `true`.
- `accessMode` (enum, required): `public` or `network-restricted`.
- `status` (enum, required): `pending`, `active`, `degraded`, `retired`.
- `lastValidatedAt` (datetime, optional): Most recent validation timestamp.
- `owner` (string, required): Responsible team or role.

### Validation Rules

- `production` mapping must include canonical host `mentalhelp.chat`.
- `development` mapping must include host `dev.mentalhelp.global`.
- `httpsOnly` must be `true` for all active mappings.
- `accessMode` for development mapping must be `network-restricted`.
- `accessMode` for production canonical mapping must be `public`.

## Entity: CertificateCoverage

Represents certificate trust and lifecycle state for one or more hostnames.

### Fields

- `id` (string, required): Unique certificate record identifier.
- `coveredHostnames` (string[], required): Hostnames protected by the certificate.
- `issuerType` (enum, required): `managed` or `external`.
- `verificationStatus` (enum, required): `provisioning`, `active`, `failed`, `expired`.
- `validFrom` (datetime, required): Certificate validity start.
- `validTo` (datetime, required): Certificate validity end.
- `autoRenewEnabled` (boolean, required): Renewal automation flag.
- `renewalOwner` (string, required): Responsible team/role for lifecycle oversight.
- `lastCheckedAt` (datetime, required): Last successful health check time.

### Validation Rules

- All active environment hostnames must appear in at least one certificate coverage record.
- `verificationStatus` must be `active` before a mapping status can be `active`.
- `validTo` must be after `validFrom`.

## Entity: AccessPolicy

Represents edge policy behavior for domain-level access controls.

### Fields

- `id` (string, required): Unique policy identifier.
- `hostname` (string, required): Hostname this policy applies to.
- `policyType` (enum, required): `network-allowlist`, `public`.
- `allowedCidrs` (string[], optional): Required when `policyType=network-allowlist`.
- `defaultAction` (enum, required): `allow` or `deny`.
- `status` (enum, required): `draft`, `enforced`, `disabled`.
- `owner` (string, required): Responsible team/role.

### Validation Rules

- `dev.mentalhelp.global` policy type must be `network-allowlist` with non-empty CIDRs.
- `mentalhelp.chat` policy type must be `public`.
- If policy is `enforced`, `defaultAction` must align with intended behavior:
  - `public` -> default allow
  - `network-allowlist` -> default deny

## Entity: RedirectRule

Represents host-level canonical and protocol redirect behavior.

### Fields

- `id` (string, required): Unique redirect rule identifier.
- `sourceHost` (string, required): Incoming host.
- `sourceProtocol` (enum, required): `http` or `https`.
- `destinationUrl` (string, required): Redirect target URL.
- `httpStatusCode` (enum, required): `301` or `308`.
- `status` (enum, required): `pending`, `active`, `disabled`.

### Validation Rules

- `www.mentalhelp.chat` HTTPS requests must redirect to `https://mentalhelp.chat`.
- HTTP requests for managed hosts must redirect to HTTPS destination.
- Redirect chains must not exceed one hop.

## Relationships

- `EnvironmentDomainMapping` 1..* -> 1..* `CertificateCoverage` by hostname.
- `EnvironmentDomainMapping` 1..1 -> 1..1 `AccessPolicy` by hostname.
- `EnvironmentDomainMapping` 0..* -> 0..* `RedirectRule` for canonical/protocol behavior.

## State Transitions

### EnvironmentDomainMapping.status

- `pending` -> `active`: DNS resolves correctly, certificate active, policy enforced.
- `active` -> `degraded`: certificate failure, routing mismatch, or policy drift detected.
- `degraded` -> `active`: all health checks pass again.
- `active` -> `retired`: mapping intentionally removed and no longer routable.

### CertificateCoverage.verificationStatus

- `provisioning` -> `active`: verification successful.
- `provisioning` -> `failed`: verification did not complete.
- `active` -> `expired`: lifecycle not renewed before validity end.
- `failed`/`expired` -> `active`: replacement or renewal completed and verified.
