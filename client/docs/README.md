# Frontend Docs

This folder is the working source of truth for the PITCHLINE frontend.

Use these docs in this order:

1. `FRONTEND_BLUEPRINT.md`
   Overall product structure, shared frontend state, routes, and component boundaries.
2. `WIREFRAMES.md`
   Page-by-page wireframe guidance for desktop and mobile layouts.
3. `CHART_STRATEGY.md`
   Chart library decision, constraints, and how the chart should behave.
4. `WALLET_AUTH_FLOW.md`
   Frontend wallet connect behavior, backend auth boundary, nonce flow, and signature verification model.
5. `WALLETCONNECT_MOBILE_PLAN.md`
   Why WalletConnect is the mobile wallet path, how to add it safely, and how to preserve desktop EVM wallet behavior.
6. `DELIVERY_PLAN.md`
   Recommended build order, milestones, and implementation sequence.

Scope notes:

- The chart is the center of the product.
- The UI should feel like a live market terminal, not a generic sports dashboard.
- Initial frontend work should be built against mock data using the planned state contract.
- Backend integration should be a swap of data source, not a redesign of the UI model.
