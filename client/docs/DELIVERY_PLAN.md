# Frontend Delivery Plan

This plan turns the frontend concept into an implementation sequence with minimal rework.

## Phase 1: Contract And Design Lock

Goal:

- agree on the frontend model before writing major UI code

Deliverables:

- page blueprint approved
- wireframes approved
- chart library decision made
- shared frontend state shape agreed

Exit condition:

- the team can describe the lobby, match view, and live match state model consistently

## Phase 2: Mock-First UI Build

Goal:

- build the full match experience without waiting for the backend

Deliverables:

- lobby page with mock fixtures
- match page shell
- chart rendering with mock probability history
- event timeline with mock events
- ticker behavior with mock deltas
- narrative panel with mock significant moments

Exit condition:

- the match page can be demoed end-to-end using only mock data

## Phase 3: Live Data Integration

Goal:

- replace mock transport with real backend data while preserving the UI model

Deliverables:

- real fixture list integration
- real live match feed integration
- proper connection state handling
- mapping from backend events to normalized frontend state

Exit condition:

- a live or replayed match updates correctly in the UI without manual patching

## Phase 4: Premium And Historical Interaction

Goal:

- add history and gated features without destabilizing the core match view

Deliverables:

- history fetch and scrub interaction
- wallet-gated unlock flow
- premium-only enhancements if still in scope

Exit condition:

- users can move from free live view to gated history without changing page architecture

## Phase 5: Polish

Goal:

- make the app judge-ready and demo-ready

Deliverables:

- loading states
- reconnect states
- empty states
- mobile QA
- animation polish
- brand consistency pass

Exit condition:

- the app reads clearly to a new user in under 30 seconds

## Recommended Build Order

1. choose chart library
2. define normalized frontend types
3. build lobby layout
4. build match page layout
5. build chart wrapper
6. build ticker and readout
7. build event timeline
8. connect mock generator
9. refine mobile behavior
10. connect real backend data

## Mock Data Requirements

The frontend should have a realistic local mock sequence that covers:

- kickoff
- early small probability movement
- goal
- yellow card
- half time
- red card or penalty event
- late equalizer or winner
- full time

This gives enough variation to test:

- markers
- ticker changes
- line movement
- narrative eligibility
- mobile density

## Decision Log

Current working decisions:

- build mobile-first
- chart dominates the match page
- use market language, not betting language
- use mock-first UI development
- default chart recommendation is `lightweight-charts`

## Open Questions

These should be resolved before implementation goes too far:

- exact backend payload shape for live updates
- exact chart library after spike if attribution becomes an issue
- whether match history lives on the main match route or a dedicated history surface
- whether team crests are guaranteed in the data source
