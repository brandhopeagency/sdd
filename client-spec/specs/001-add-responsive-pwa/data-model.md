# Data Model: Responsive Touch-Friendly UI and PWA Capability

This feature introduces validation-focused entities for planning and testing.
These are conceptual entities used for acceptance and quality gates.

## Entity: ViewportClass

**Purpose**: Defines the viewport category used for responsive validation.

**Fields**:
- `id` (string): Unique identifier (e.g., `phone`, `tablet`, `desktop`)
- `label` (string): Human-readable class name
- `widthRange` (string): Accepted width range for validation matrix
- `orientationCoverage` (string[]): Required orientations (`portrait`, `landscape`) where relevant
- `coreJourneys` (string[]): Core journeys required to pass in this class

**Validation rules**:
- `id` MUST be one of the approved viewport classes.
- `coreJourneys` MUST include all critical user flows defined in the feature scope.

## Entity: InteractionSurface

**Purpose**: Represents a critical interactive region that must be touch-usable.

**Fields**:
- `id` (string): Unique control/action identifier
- `route` (string): Screen/route where interaction appears
- `actionType` (string): Interaction intent (navigate, submit, toggle, select)
- `isCritical` (boolean): Whether this action blocks core flow completion
- `inputModes` (string[]): Supported modes (`touch`, `keyboard`, `pointer`)
- `usabilityExpectation` (string): Touch-comfort expectation statement

**Validation rules**:
- Critical surfaces MUST support touch input.
- Critical surfaces MUST remain reachable in all required viewport classes.

## Entity: InstallabilityStatus

**Purpose**: Describes runtime install path behavior across supported/unsupported contexts.

**Fields**:
- `platform` (string): Browser/platform context identifier
- `isInstallSupported` (boolean): Whether install capability exists
- `isInstallAvailable` (boolean): Whether install criteria are currently met
- `installActionPresented` (boolean): Whether user sees an install path when available
- `fallbackMode` (string): Behavior when install is not supported
- `startExperienceVerified` (boolean): Post-install launch/start behavior verified

**Validation rules**:
- If `isInstallSupported=true` and criteria are met, `installActionPresented` MUST be true.
- If `isInstallSupported=false`, `fallbackMode` MUST preserve full browser usage.

## Relationships

- `ViewportClass` 1..* `InteractionSurface`: each viewport validates multiple critical surfaces.
- `InstallabilityStatus` maps to runtime contexts used in release validation matrix.

## State Transitions

### Installability state

`unsupported` -> `browser-fallback`  
`supported-but-unavailable` -> `available-to-install` -> `installed` -> `launched`

Transitions must preserve access to core flows at every step.
