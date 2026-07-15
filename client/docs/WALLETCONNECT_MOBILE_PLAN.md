# WalletConnect Mobile Plan

## Scope

This plan is for frontend work inside `client` only.

It does not require touching:

- `match-engine`
- `annotation-service`
- root backend docs
- backend auth/session code
- smart contracts
- EVM chain configuration outside the client

The goal is to let mobile users connect a wallet and view gated match pages without needing a desktop browser extension.

## Current Problem

The current wallet flow depends on injected EVM browser wallets.

Today the client looks for wallet providers in the browser, then uses EVM JSON-RPC methods such as:

- `eth_requestAccounts`
- `eth_accounts`
- `eth_chainId`

That works well on desktop when users have MetaMask, Rabby, Coinbase Wallet, Phantom, Trust Wallet, or another injected EVM wallet extension installed.

It does not work reliably on normal mobile browsers because mobile browsers usually do not have extension support. Users may have a wallet app installed on their phone, but the Pitchline web page cannot assume that wallet is injected into Safari, Chrome, or an in-app browser.

## Why Choose WalletConnect

WalletConnect is the most practical choice because it solves the mobile connection gap without changing our EVM product model.

Reasons:

- It supports mobile wallet apps through QR codes, deep links, and app-to-app approval flows.
- It lets the user keep their own wallet instead of creating a custodial or embedded wallet.
- It can work alongside injected desktop wallets.
- It supports EVM flows through current React tooling such as Reown AppKit with Wagmi, Ethers, Viem, and EVM networks.
- It does not require the frontend team to build or own private-key management.
- It keeps Pitchline closer to standard Web3 UX, which users with existing wallets already understand.

Official implementation references:

- Reown AppKit React installation: https://docs.reown.com/appkit/react/core/installation
- Reown AppKit Wagmi/EVM adapter example: https://docs.reown.com/appkit/react/core/installation#wagmi-example
- WalletConnect wallet guide: https://walletguide.walletconnect.network

## What WalletConnect Changes

WalletConnect changes how a wallet connection is established.

Instead of relying only on `window.ethereum`, mobile users can:

1. Tap `Connect Wallet`.
2. Choose a supported wallet app.
3. Approve the connection inside that wallet app.
4. Return to Pitchline.
5. Continue with the same wallet-aware match gating flow.

The wallet address and chain still represent an EVM wallet session. The frontend should continue treating the result as:

- address
- chain id
- connected/disconnected status
- user rejected request
- account changed
- chain changed

## What WalletConnect Does Not Change

WalletConnect should not change our core EVM assumptions.

It should not:

- move us away from EVM
- require Solana, Bitcoin, or another chain
- replace our current desktop wallet extension flow in the first implementation
- require backend wallet authentication by itself
- make frontend-only wallet connection a trusted identity system
- change match data APIs
- change market data APIs

WalletConnect is a transport and wallet UX improvement. It is not a backend auth layer.

## Recommended Implementation Strategy

Use WalletConnect as an additional mobile-friendly connection path while preserving the current injected EVM wallet behavior.

The safest approach is phased:

### Phase 1. Preserve Current Desktop EVM Flow

Keep the current injected wallet flow as the desktop baseline.

Current behavior to preserve:

- EIP-6963 wallet discovery
- legacy `window.ethereum` fallback
- desktop wallet picker when multiple injected wallets exist
- `eth_requestAccounts`
- `eth_chainId`
- local wallet connection state
- account and chain change listeners

This reduces risk because desktop users keep the exact flow that already works.

### Phase 2. Add WalletConnect As Mobile Fallback

Add a WalletConnect option when:

- no injected EVM wallet is detected
- the user is on mobile
- the user explicitly chooses `WalletConnect`
- an injected wallet is available but the user prefers wallet-app connection

Expected UI behavior:

- Desktop with extension: show existing injected wallet options first.
- Desktop without extension: show WalletConnect QR/modal option.
- Mobile: show WalletConnect/wallet-app option first.
- Mobile with injected in-app wallet: still allow injected connection if available.

### Phase 3. Normalize Wallet State

The rest of the client should not care whether the wallet came from an injected provider or WalletConnect.

Create a shared frontend wallet state shape:

```ts
type WalletConnectionSource = "injected" | "walletconnect";

type WalletConnectionState = {
  source: WalletConnectionSource;
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  status: "idle" | "checking" | "connecting" | "connected" | "error";
  error: string | null;
};
```

The existing UI can continue reading:

- `wallet.isConnected`
- `wallet.address`
- `wallet.addressLabel`
- `wallet.chainId`
- `wallet.status`
- `wallet.error`

The implementation should hide connection-source differences inside the wallet session layer.

### Phase 4. Keep EVM Chain Configuration Explicit

Configure WalletConnect only for the EVM chains Pitchline supports.

Do not enable every chain by default. The app should define an allowed chain list in the client wallet setup.

Current decision:

- Pitchline should require Ethereum mainnet for now.
- The active chain id should be `0x1`.
- WalletConnect should not be treated as permission to support every EVM network.

Where to change this later:

- Update the supported network list in `client/config/walletconnect.ts`.
- Update the frontend chain guardrails when they are added.
- Update this document so product, frontend, and QA stay aligned.

Examples:

- Ethereum mainnet, if production uses mainnet
- Base, Polygon, Arbitrum, or another EVM chain, if that is what the product uses
- testnets only in development/staging

The exact chain list should match the current product decision. WalletConnect should not silently expand product support to unrelated chains.

### Phase 5. Add Chain Guardrails

Before allowing the user into a gated match view, check that the connected chain is supported.

Frontend behavior:

- if address is connected and chain is supported, allow the existing gated UI flow
- if address is connected but chain is unsupported, show a clear `Wrong network` state
- if the wallet library supports network switching, offer a switch action
- if switching fails or is unsupported, tell the user which network to select manually

This protects the existing EVM assumptions and prevents mobile users from appearing connected on the wrong chain.

## Recommended Library Direction

Use Reown AppKit with the EVM/Wagmi adapter unless there is a strong reason not to.

Expected packages:

```bash
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query
```

Notes:

- `@tanstack/react-query` is already present in the client.
- Wagmi/Viem would be new wallet-layer dependencies.
- The implementation should be isolated inside the client wallet session/provider code.
- If we decide not to introduce Wagmi, we should choose a lower-level WalletConnect EVM provider deliberately, but AppKit is the more standard product-facing route.

## Proposed Frontend Files To Touch Later

When implementation starts, likely files are:

- `client/lib/wallet-session.ts`
- `client/components/app-header/wallet-control.tsx`
- `client/components/app-header.tsx`
- possibly a new `client/lib/walletconnect-session.ts`
- possibly a new `client/components/wallet-connect-provider.tsx`

Files outside `client` should not be touched for this frontend implementation.

## Environment Variable Needed

WalletConnect/Reown AppKit requires a project id from the Reown dashboard.

Recommended client env variable:

```env
NEXT_PUBLIC_REOWN_PROJECT_ID=...
```

Rules:

- use a public `NEXT_PUBLIC_` value because the client needs it
- do not commit real secrets
- use separate project metadata for development/staging/production if needed
- configure the metadata domain to match the real Pitchline domain before production

## UX Flow

### Desktop User With Extension

1. User clicks `Connect Wallet`.
2. Client detects injected EVM wallets.
3. User selects the wallet if multiple exist.
4. Wallet extension opens.
5. User approves.
6. Client stores address and chain id.
7. User enters the match/markets flow.

This should remain the current default.

### Mobile User

1. User taps `Connect Wallet`.
2. Client opens the WalletConnect/AppKit wallet selector.
3. User chooses their mobile wallet.
4. Wallet app opens through deep link or universal link.
5. User approves the connection.
6. User returns to Pitchline.
7. Client receives address and chain id.
8. Client checks chain support.
9. User enters the match/markets flow.

### Desktop User Without Extension

1. User clicks `Connect Wallet`.
2. Client sees no injected wallet.
3. Client opens WalletConnect/AppKit.
4. User scans a QR code with their mobile wallet.
5. User approves.
6. Client receives address and chain id.
7. User enters the match/markets flow.

## Auth Boundary

WalletConnect does not remove the need for backend wallet auth later.

For the frontend-only version:

- WalletConnect proves the user approved a wallet connection in the browser session.
- It is enough for demo UI gating.
- It is not enough for reliable user counting, paid access, or protected backend resources.

For real authentication later, the backend still needs the nonce/signature flow described in `WALLET_AUTH_FLOW.md`.

## Risks And Mitigations

### Risk: Desktop EVM Flow Breaks

Mitigation:

- keep injected wallet support as the first path on desktop
- add WalletConnect as a second connection source
- avoid replacing the whole wallet store in one step
- test MetaMask/Rabby/Coinbase injected flows after adding WalletConnect

### Risk: Wrong Chain Connection

Mitigation:

- define supported EVM chains explicitly
- reject unsupported chains in the frontend UI
- show network-switch guidance before match access

### Risk: Mobile Return Flow Is Confusing

Mitigation:

- use AppKit's wallet selector instead of a custom deep-link-only approach
- show `Connecting...` while the wallet app approval is pending
- handle user rejection and timeout states clearly

### Risk: We Accidentally Add Backend Scope

Mitigation:

- limit the first implementation to `client`
- keep all backend auth requirements documented but unimplemented
- do not modify API contracts in this task

### Risk: WalletConnect Project Configuration Is Missing

Mitigation:

- fail gracefully when `NEXT_PUBLIC_REOWN_PROJECT_ID` is missing
- show desktop injected wallets if available
- show a clear setup error in development

## Acceptance Criteria

The implementation should be considered successful when:

- desktop injected EVM wallet connect still works
- multiple desktop injected wallets can still be selected
- mobile users can connect through WalletConnect/AppKit
- desktop users without extensions can connect by QR code
- the app receives an EVM address and chain id from both connection paths
- unsupported chains are blocked before gated match access
- no backend code is changed
- no non-client files are changed except documentation if explicitly requested

## Recommended Build Order

1. Add Reown project id configuration.
2. Add WalletConnect/AppKit setup inside the client wallet layer.
3. Add a `walletconnect` connection source beside the current `injected` source.
4. Preserve current injected provider behavior.
5. Update the connect button/modal so mobile users can choose WalletConnect.
6. Normalize WalletConnect result into the existing wallet state shape.
7. Add supported-chain guardrails.
8. Test desktop extension, desktop QR, and mobile app approval flows.

## Final Recommendation

Use WalletConnect/Reown AppKit for mobile wallet support, but do not replace the current injected EVM flow immediately.

The right frontend architecture is:

```text
Desktop injected wallet -> existing EVM provider flow -> normalized wallet state
Mobile wallet app       -> WalletConnect/AppKit flow  -> normalized wallet state
```

That gives mobile users a working path while protecting the existing PC/EVM experience.

