---
name: frontend-product-engineering
description: Builds and modifies production-quality frontend interfaces in any language or framework. Use for pages, components, templates, layouts, forms, interactions, responsive behavior, accessibility, client state, visual refinement, and frontend testing. Discover and follow the repository's existing stack, design system, and architecture instead of imposing framework-specific patterns.
---

# Frontend Product Engineering

## Overview

Build frontend interfaces that are accessible, responsive, performant, maintainable, and visually coherent.

This skill is language- and framework-agnostic. Apply its standards to server-rendered templates, component frameworks, web components, compiled frontend languages, or other UI architectures.

The result must look and behave like part of the existing product, not like a generic generated interface.

## Core Directives

1. Inspect the repository before selecting an implementation pattern.
2. Follow existing architecture, naming, styling, state, data, and testing conventions.
3. Reuse the design system before creating new primitives.
4. Prefer the smallest coherent change that fully solves the user-visible problem.
5. Treat loading, empty, error, partial, success, disabled, and permission states as part of the feature.
6. Preserve native semantics, keyboard operation, focus behavior, and assistive-technology support.
7. Verify behavior and visual states, not only compilation.
8. Do not introduce a framework, state library, styling system, or component library unless the task requires it.
9. Do not rewrite working code merely into a more familiar technology.
10. Never claim accessibility, responsiveness, or verification that was not actually checked.

## When to Use

Use this skill when:

- Building or modifying pages, screens, components, widgets, or templates
- Implementing responsive layouts
- Creating forms, dialogs, menus, navigation, tables, lists, or dashboards
- Adding client-side interaction or state
- Integrating UI with remote data
- Improving accessibility, usability, visual quality, or perceived performance
- Fixing frontend defects or regressions
- Reviewing frontend implementation quality
- Translating product or design requirements into production UI

## Operating Procedure

### 1. Discover the Existing System

Before editing, identify:

- Language and UI framework
- Rendering model
- Package manager and build scripts
- Routing conventions
- Component or template organization
- Styling approach and design tokens
- Reusable UI primitives
- State-management conventions
- Data-fetching and caching conventions
- Form and validation conventions
- Test frameworks and test locations
- Formatting, linting, type-checking, build, and accessibility commands
- Browser or platform support requirements
- Existing implementation closest to the requested behavior

Inspect configuration, nearby features, shared primitives, tests, and styles. Do not infer the project architecture from a single file when the repository can answer the question.

### 2. Define the UI Contract

Determine:

- Primary information and primary action
- Secondary and destructive actions
- Source of truth for each state
- Loading, empty, partial, stale, success, and error behavior
- Permissions and disabled behavior
- Keyboard and focus requirements
- Narrow-screen and long-content behavior
- Relevant design-system primitives
- Expected navigation, persistence, and recovery behavior

When requirements are incomplete, infer from comparable product flows and repository conventions. Ask only when a missing decision materially changes product behavior, data safety, or scope.

### 3. Implement the Smallest Coherent Change

A coherent frontend change includes, when relevant:

- Semantic structure
- Styling and responsive behavior
- Interaction and state transitions
- Loading, empty, error, and disabled states
- Accessibility behavior
- Appropriate tests
- Removal of debug output and dead code

Avoid unrelated refactors. Refactor adjacent code only when required for correctness, consistency, accessibility, or testability.

### 4. Verify the Result

Run the narrowest relevant checks first:

1. Formatter or style validation
2. Static analysis and linting
3. Type checking or compilation
4. Focused unit or component tests
5. Relevant integration or end-to-end tests
6. Production build
7. Manual interaction and responsive review
8. Accessibility inspection

Use repository-defined commands. Do not invent generic commands when project scripts exist.

## Technology-Neutral Decision Rules

### Specify Outcomes, Not Favorite Tools

Prefer requirements such as:

- Filter state is shareable through the URL.
- The dialog contains focus and restores it when closed.
- Server-owned data follows the project's caching policy.
- The component exposes a small public interface.

Do not prescribe a specific hook, store, utility library, or CSS technique before inspecting the project.

### Preserve Local Conventions

When several implementations are valid:

1. Use an established project pattern.
2. Reuse an existing primitive or utility.
3. Extend the existing pattern consistently.
4. Introduce an abstraction only when repetition or complexity justifies it.
5. Add a dependency only when its benefit exceeds maintenance, security, and bundle cost.

### Avoid Familiarity Rewrites

Do not translate working code into another language, framework, component model, or styling approach merely because it is easier for the agent.

## Information Architecture

Start with content priority rather than decoration.

- Make the primary task clear.
- Group related information and actions.
- Keep secondary actions subordinate.
- Separate destructive actions from routine actions.
- Use spacing and typography to express hierarchy.
- Do not give every item equal visual weight.
- Prefer recognizable interaction patterns.
- Keep system status visible.
- Use labels that describe the action or outcome.

The interface should remain understandable without decorative gradients, shadows, illustrations, or animation.

## Design-System Adherence

### Reuse Before Creating

Search for existing:

- Buttons and links
- Form controls
- Dialogs, drawers, menus, and popovers
- Typography styles
- Layout containers
- Tables, lists, cards, and empty states
- Icons
- Feedback and status components
- Loading indicators
- Spacing, color, radius, elevation, and motion tokens

Do not recreate a primitive locally when the project already provides one.

### Use Semantic Tokens

Prefer semantic design roles rather than raw visual values:

```text
foreground-primary
foreground-muted
surface-default
surface-raised
border-default
status-danger
status-success
space-small
radius-control
motion-fast
```

Use the repository's actual token names. Avoid arbitrary values unless the existing project intentionally uses them.

### Avoid the Generic AI Aesthetic

Do not default to:

- Purple or indigo palettes without product justification
- Decorative gradients
- Excessively rounded containers
- Uniform card grids for unrelated content
- Oversized headings or padding
- Layered shadows
- Generic hero sections
- Glass effects
- Placeholder marketing copy
- Animation without interaction value

Use the product's visual language. When no design system exists, create a restrained and internally consistent hierarchy based on the domain and content.

### Typography and Content

- Preserve semantic heading order.
- Keep line lengths readable.
- Do not use heading styles for non-heading content.
- Test long labels, names, numbers, and localized text.
- Do not truncate important information without a way to access it.
- Use realistic content instead of lorem ipsum.

### Color and Contrast

- Meet the repository's target, at minimum WCAG AA unless told otherwise.
- Never use color as the only state indicator.
- Preserve contrast in hover, focus, active, selected, disabled, and error states.
- Check light and dark themes when supported.
- Avoid low-opacity text that becomes unreadable.

## Component and Module Architecture

"Component" means the smallest reusable UI unit in the project's architecture. It may be a template partial, widget, view, function, class, custom element, or framework component.

### Keep Responsibilities Focused

Split a unit when it combines independent concerns such as:

- Remote-data orchestration
- Domain transformation
- Several unrelated interaction regions
- Large conditional layout branches
- Reusable visual primitives
- Unrelated side effects

File length is a warning signal, not an absolute rule. Cohesion and testability matter more than a fixed limit.

### Prefer Composition

Build larger interfaces from focused units:

```text
Page
├── PageHeader
├── FilterRegion
├── ResultSummary
├── ResultCollection
│   └── ResultItem
└── Pagination
```

Avoid highly configurable units with many unrelated flags, variants, callbacks, and content fields. When configuration becomes combinatorial, compose smaller units.

### Separate Concerns Without Forcing Layers

Keep these concerns distinguishable:

- Data acquisition
- Domain or view-model transformation
- Interaction state
- Rendering
- Styling
- Side effects
- Navigation
- Analytics

They do not always need separate files. Separate them when clarity, reuse, or testing improves.

### Keep Public Interfaces Small

Prefer:

- Domain-relevant inputs
- Explicit events
- Stable composition points
- Predictable defaults

Avoid:

- Passing large internal state objects
- Boolean flags that allow invalid combinations
- Leaking implementation-specific dependencies
- Requiring callers to coordinate internal sequencing

### Follow Repository Organization

Colocate implementation, tests, styles, stories, fixtures, and local types when that is the established convention. Otherwise follow the repository's feature-based, layer-based, or package-based structure.

## State Ownership and Data Flow

### Identify the Source of Truth

For every state value, determine whether it belongs to:

- The local UI unit
- A parent or feature boundary
- The URL or navigation state
- A form model
- A remote-data cache
- A global application service
- Persistent local storage
- The backend

Do not duplicate a source of truth across layers without explicit synchronization rules.

### Use the Narrowest Correct Scope

Use:

- Local state for isolated transient interaction
- Feature state for coordination among nearby units
- URL state for shareable or reload-persistent navigation state
- Remote-data infrastructure for server-owned state
- Global state only for genuinely cross-cutting client-owned state
- Persistent storage only when persistence is a product requirement

Do not use global state merely to bypass a poorly structured component tree.

### Model Explicit States

Prefer explicit states over loosely related booleans:

```text
idle
loading
success
empty
partial
error
submitting
submitted
```

Make impossible state combinations difficult to represent.

### Derive Rather Than Synchronize

Calculate display values from existing state when practical. Do not store derived state and maintain it through effects, watchers, or observers unless lifecycle or performance constraints justify it.

## Remote Data

Treat remote data as server-owned state.

Account for:

- Initial loading
- Background refresh
- Pagination or incremental loading
- Empty and partial results
- Stale data
- Request and mutation errors
- Retry and cancellation
- Authentication and permission failures
- Race conditions
- Offline or degraded connectivity when relevant

When requests overlap:

- Cancel superseded work when supported.
- Ignore responses that no longer match the active request.
- Preserve request identity.
- Prevent old results from replacing newer results.
- Deduplicate repeated mutations when necessary.

Use optimistic updates only when success is likely, the local result is predictable, rollback is safe, and failure feedback is clear.

## Forms and Validation

- Give every control an accessible name.
- Use the platform's appropriate input semantics.
- Preserve keyboard submission behavior.
- Validate at a useful time.
- Place errors near the affected control.
- Add an error summary for large forms when useful.
- Preserve entered values after recoverable failure.
- Distinguish required, optional, disabled, read-only, and unavailable fields.
- Do not use placeholder text as the only label.
- Explain formatting requirements.
- Prevent duplicate submissions where necessary.
- Confirm destructive actions proportionally to risk.
- Treat backend validation and authorization as authoritative.

## Accessibility

Target WCAG 2.2 AA when practical, or the repository's declared standard if stricter.

### Semantics First

Use native interactive semantics before recreating them.

- Actions use action controls.
- Navigation uses links or the platform's navigation primitive.
- Lists, tables, headings, and landmarks reflect content structure.
- Form controls have programmatic labels.
- Status and error messages are exposed to assistive technology.

Accessibility attributes fill semantic gaps; they do not replace correct native structure.

### Keyboard Interaction

Verify:

- Logical tab order
- Visible focus
- Enter and Space behavior where expected
- Arrow-key behavior for composite widgets where required
- Escape behavior for dismissible overlays
- No unintended keyboard traps
- Skip navigation or equivalent for repeated content when applicable

Do not attach interaction to a non-interactive element without implementing its complete semantic and keyboard contract. Prefer the correct native control.

### Names, Roles, and States

Assistive technology must be able to determine:

- What an element is
- What it is called
- Its current state
- Whether it is expanded, selected, checked, invalid, busy, or disabled
- Its relationship to instructions and errors

Icon-only controls require an accessible name.

### Focus Management

- Move focus into modal interfaces.
- Contain focus while a modal is active.
- Restore focus sensibly when it closes.
- Move focus to new errors or content only when helpful.
- Do not reset or steal focus during routine updates.

### Dynamic Updates

Announce important asynchronous changes such as submission results, validation summaries, loaded results, and connection status. Avoid excessive live announcements.

### Motion and Input

- Respect reduced-motion preferences.
- Avoid flashing content.
- Keep motion purposeful.
- Do not require hover.
- Provide adequate target size and spacing.
- Support zoom, text resizing, touch, pointer, and keyboard input.
- Do not require gesture-only actions without an alternative.

## Responsive Design

Design for content and available space, not specific device models.

- Start with the narrowest supported layout unless project conventions say otherwise.
- Let content reflow rather than only shrink.
- Prefer flexible and intrinsic sizing.
- Add breakpoints when content needs them.
- Avoid horizontal scrolling except for intentionally scrollable data regions.
- Keep critical actions available at narrow widths.
- Prevent fixed elements from obscuring content.
- Account for safe areas and virtual keyboards when relevant.

Test:

- Narrow, medium, and wide viewports
- High zoom or large text
- Long labels and names
- Empty and maximum-content states
- Localization expansion
- Reduced height
- Touch and keyboard input

Reference widths such as 320, 768, 1024, and 1440 pixels are useful checkpoints, not substitutes for content-driven testing.

### Data-Dense Interfaces

For tables and dashboards:

- Preserve column meaning.
- Prioritize essential information.
- Do not hide arbitrary data at narrow widths.
- Associate row and column headers correctly.
- Use horizontal scrolling when it is the clearest option.
- Prevent sticky regions from covering focused content.

## Loading, Empty, Error, and Disabled States

### Loading

- Use skeletons when preserving layout improves comprehension.
- Use progress indicators when operation status matters.
- Keep existing content visible during safe background refresh.
- Mark busy regions accessibly.
- Prevent avoidable layout shift.
- Do not show an indefinite spinner without context or recovery.

### Empty

Differentiate:

- No data exists yet
- No results match filters
- The user lacks permission
- Content is unavailable
- Data failed to load

Explain the situation and provide the most relevant next action when one exists.

### Error

- Explain what failed in user terms.
- Preserve recoverable context.
- Provide retry or recovery where useful.
- Do not expose stack traces or raw transport errors.
- Place errors near the affected region.
- Send diagnostic detail through project observability, without sensitive data.

### Disabled and Unavailable

- Explain why an action is unavailable when useful.
- Distinguish disabled from loading.
- Avoid silently ignoring input.
- Do not disable a control when the user must interact with it to learn what is required.

## Interaction Design

- Give immediate feedback for actions.
- Make hover, focus, active, selected, checked, expanded, disabled, and loading states distinct.
- Make destructive actions explicit.
- Prefer undo when safer and less disruptive than confirmation.
- Preserve user context across navigation and refresh when required.
- Avoid surprising scroll jumps.
- Keep overlays open after failed submission unless entered work is preserved.
- Protect repeated actions from accidental duplication.
- Use animation to explain state or spatial change, not as decoration.

## Performance

Optimize measured or likely user impact.

- Avoid unnecessary requests.
- Avoid unused code and large dependencies.
- Prevent repeated expensive rendering or computation.
- Reserve media space to reduce layout shift.
- Load non-critical resources progressively.
- Use suitable media formats and dimensions.
- Virtualize large collections only when needed.
- Debounce or throttle high-frequency work without breaking correctness.
- Keep interaction feedback responsive.

Do not sacrifice correctness, accessibility, or maintainability for speculative micro-optimizations.

## Security and Privacy

Frontend code is not a security boundary.

- Do not embed secrets.
- Do not treat hidden or disabled fields as authorization.
- Escape or sanitize untrusted content for its rendering context.
- Avoid unsafe direct markup injection.
- Preserve authentication and anti-forgery conventions.
- Minimize collection and exposure of personal data.
- Avoid logging sensitive values.
- Do not preload permission-gated data and merely hide it in the client.
- Treat server authorization as authoritative.

## Testing Strategy

Choose the lowest test level that proves the behavior.

### Static Checks

Use available formatter, linter, compiler, type checker, template validator, style validator, and accessibility rules.

### Unit Tests

Use for:

- Pure transformations
- Formatting and validation
- State transitions
- Domain-specific view models
- Deterministic utilities

### Component or View Tests

Use for:

- Rendered states
- User interaction
- Accessible names and roles
- Form behavior
- Conditional content
- Events
- Focus behavior when supported

Test through the public UI contract rather than internal implementation details.

### Integration Tests

Use for:

- Data-loading flows
- Routing
- Cross-component coordination
- Submission and error recovery
- Authentication or permission-dependent behavior
- Cache and mutation behavior

### End-to-End Tests

Reserve for critical journeys and major integration boundaries, such as authentication, checkout, payments, account changes, and core creation or editing flows.

### Visual Review

Inspect:

- Narrow and wide layouts
- Long content
- Empty, loading, error, partial, and success states
- Theme variants
- Focus states
- Zoom or large text
- Reduced motion

Snapshots detect changes but do not prove usability or accessibility.

## Implementation Quality Rules

- Do not leave debug logging, temporary flags, or commented-out implementations.
- Do not suppress warnings without understanding them.
- Do not duplicate existing utilities or primitives.
- Do not add arbitrary design values without checking the design system.
- Do not hide errors to make tests pass.
- Do not weaken types or validation merely to compile.
- Do not ignore asynchronous race conditions.
- Do not create abstractions for a single simple use without a clear reason.
- Do not combine unrelated cleanup with the requested feature.
- Do not report checks that were not run.

## Common Rationalizations

| Rationalization | Required Response |
|---|---|
| "It is only a prototype." | Reduce scope, not accessibility or responsive foundations. |
| "We can add error handling later." | Implement errors created by this flow now. |
| "The design is not final." | Use existing tokens and primitives. |
| "The library handles accessibility." | Verify rendered behavior and integration. |
| "It works on my screen." | Test width, zoom, content, and input stress conditions. |
| "A global store is easier." | Use the narrowest correct state boundary. |
| "A new dependency is faster." | Check existing capabilities and account for long-term cost. |
| "Users will not use the keyboard." | Keyboard support is part of the interaction contract. |
| "The API usually succeeds." | Implement failure and recovery behavior. |
| "The backend validates it." | Provide frontend guidance while keeping backend validation authoritative. |

## Red Flags

Investigate:

- Large units with unrelated responsibilities
- Many booleans controlling incompatible modes
- Duplicated server data in client state
- Observers or effects synchronizing derived values
- Raw design values bypassing established tokens
- Click handlers on non-interactive elements
- Missing labels, focus states, or keyboard behavior
- Loading without error or empty handling
- Destructive actions with unclear consequences
- Important content available only on hover
- Layouts dependent on short text
- Arbitrary breakpoints added for one screenshot
- Full-page blocking for a local action
- Dependencies duplicating existing capabilities
- Framework rewrites unrelated to the task
- Generic styling disconnected from the product
- Tests coupled to implementation details
- Suppressed accessibility or runtime warnings

## Verification Checklist

### Repository Alignment

- [ ] Uses the repository's language, framework, architecture, and naming conventions
- [ ] Reuses existing primitives, tokens, utilities, and dependencies
- [ ] Introduces no unnecessary framework, library, or styling approach
- [ ] Limits changes to the requested behavior and necessary supporting work

### Behavior

- [ ] Primary flow works
- [ ] Relevant loading, empty, partial, error, success, and disabled states work
- [ ] Repeated, concurrent, and failed actions behave safely
- [ ] Navigation and persistence match product expectations
- [ ] Recoverable failures preserve user input

### Accessibility

- [ ] Structure and controls use correct semantics
- [ ] Every control has an accessible name
- [ ] The flow works by keyboard
- [ ] Focus is visible and managed correctly
- [ ] Dynamic status and errors are conveyed accessibly
- [ ] Color is not the only state indicator
- [ ] Contrast meets the target
- [ ] Motion respects user preferences

### Responsive and Visual Quality

- [ ] Works at narrow, medium, and wide widths
- [ ] Remains usable with zoom, large text, and long content
- [ ] Follows the design system
- [ ] Interaction states are distinct
- [ ] No generic decoration was added without product justification
- [ ] Overflow and layout shift were checked

### Performance, Security, and Privacy

- [ ] Adds no obvious unnecessary requests, dependencies, or repeated expensive work
- [ ] Asynchronous content preserves layout where practical
- [ ] Untrusted content is rendered safely
- [ ] No secrets or sensitive diagnostics are exposed
- [ ] Client permission behavior is backed by server enforcement

### Tests and Tooling

- [ ] Relevant formatting, linting, type checking, or compilation passes
- [ ] Focused tests cover the changed behavior
- [ ] Relevant integration or end-to-end tests pass
- [ ] Production build passes when practical
- [ ] Manual interaction and responsive checks were performed
- [ ] Accessibility tooling reports no new relevant violations
- [ ] Unperformed checks are explicitly reported

## Completion Report

When reporting completed work, state:

1. What user-visible behavior changed
2. Which existing architecture and design-system patterns were reused
3. Which edge states were handled
4. Which tests and verification commands ran
5. Any assumptions, limitations, or checks not performed
