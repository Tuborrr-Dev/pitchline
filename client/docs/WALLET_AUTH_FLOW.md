# Wallet Connect And Auth Flow

## Scope

This document covers the frontend wallet connection flow now used in the Next.js client.

Current scope:

- frontend-only wallet connect
- injected EVM wallets in the browser
- UI gating based on wallet connection state

Out of scope for the current implementation:

- backend wallet authentication
- signature verification
- user account creation
- wallet-based analytics or user counting

## What The Frontend Does Today

The frontend currently connects to an injected browser wallet such as MetaMask by calling:

- `eth_requestAccounts`
- `eth_chainId`

The frontend then stores wallet session state in a shared client-side store and listens for:

- `accountsChanged`
- `chainChanged`
- `disconnect`

This is enough to:

- open the wallet prompt
- read the selected wallet address
- show connected or disconnected UI
- gate access to pages in the browser

This is not enough to prove identity to the backend.

## Important Distinction

There are three different levels of wallet integration.

### 1. Wallet Connection

This only means the browser has permission to read the user wallet address.

The frontend can know:

- a wallet exists
- which address is selected
- which chain is active

The backend does not automatically know any of this.

### 2. Wallet Authentication

This means the backend has verified that the user controls a wallet address.

To do this safely, the backend must issue a one-time message or nonce and ask the frontend user to sign it with their wallet.

The backend can then verify the signature and create a real authenticated session.

### 3. Wallet Authorization

This means the app uses that authenticated wallet identity to decide what the user can do.

Examples:

- allow access to premium features
- allow access only to holders of a token or NFT
- rate limit by wallet identity
- store user preferences against a wallet-linked account

## Why Frontend-Only Connect Does Not Give Reliable User Counts

If wallet connect happens only in the browser:

- the backend does not receive a trusted identity
- the same person can appear on multiple devices
- local storage can be cleared
- the frontend can claim any state without backend proof
- there is no persistent user record unless the app sends one to a server

So yes, if the backend never participates, you will not have a reliable number of users.

At best, frontend-only connect gives:

- local UI state
- rough client analytics if you send events
- no trustworthy identity layer

## Full Recommended Flow

This is the standard wallet auth flow when the product needs real users, sessions, analytics, or gated access.

### Step 1. User clicks Connect Wallet

Frontend:

- detects `window.ethereum`
- calls `eth_requestAccounts`
- receives wallet address

Result:

- the browser knows the selected wallet
- the UI can show the address

### Step 2. Frontend asks backend for a nonce

Frontend sends:

- wallet address

Backend creates:

- a random one-time nonce
- an auth message that includes the nonce
- optional expiry timestamp

Example message content:

- app name
- wallet address
- nonce
- issued time
- expiration time

Result:

- the backend creates a challenge that cannot be replayed safely later

### Step 3. User signs the message in the wallet

Frontend asks the wallet to sign the backend-provided message.

Common methods:

- `personal_sign`
- `eth_signTypedData_v4`

Result:

- the frontend gets a signature
- the user has cryptographically approved the auth challenge

### Step 4. Frontend sends signed message to backend

Frontend sends:

- wallet address
- original message or structured payload
- signature
- nonce id if needed

### Step 5. Backend verifies the signature

Backend checks:

- the nonce exists
- the nonce is unexpired
- the nonce has not already been used
- the signature matches the wallet address
- the message is exactly what the backend issued

If valid:

- mark nonce as used
- create or find user record
- create session or JWT

This is the point where the backend truly knows the user.

### Step 6. Backend returns authenticated session

Possible session approaches:

- HTTP-only cookie session
- JWT access token
- short-lived access token plus refresh token

After this, the frontend calls protected APIs normally.

## What A Nonce Is

A nonce is a one-time random value used to stop replay attacks.

Without a nonce:

- a signature captured once could be reused by an attacker later

With a nonce:

- each login challenge is unique
- each signature is valid for one auth attempt only
- the backend can reject reused or expired signatures

So yes, nonce auth is part of authenticating the user.

More precisely:

- the nonce is not the identity by itself
- the nonce is the anti-replay challenge used during authentication

## Why Signature Verification Matters

A wallet address alone proves nothing.

Anyone can type or send:

- `0xabc123...`

That does not prove they control the private key for that address.

A valid signature proves:

- the signer controls the wallet private key
- the user approved the exact message being verified

That is why backend auth must verify a signature, not just accept a wallet address from the frontend.

## What The Backend Can Know After Proper Wallet Auth

Once the signature has been verified and a session is created, the backend can reliably track:

- unique wallet addresses that authenticated
- returning users
- active sessions
- usage history
- premium eligibility
- wallet-linked profile data

At that point, analytics become meaningful.

## What The Backend Still Should Not Assume

Even with wallet auth:

- one person can own multiple wallets
- one wallet can be used across multiple devices
- wallet address does not automatically equal legal identity

So wallet auth gives a strong product identity, not a real-world identity.

## Recommended Division Of Responsibility

### Frontend

- connect wallet
- display wallet state
- request nonce from backend
- ask wallet to sign message
- send signature to backend
- store authenticated app session state

### Backend

- issue nonce
- construct auth challenge
- verify signatures
- mark nonce as used
- create user record
- create session or token
- enforce protected routes and entitlements
- track analytics based on authenticated identity

## Practical Recommendation For PITCHLINE

For the current hackathon frontend, wallet connect in the browser is enough if the goal is only:

- unlock UI
- demo gated entry
- show wallet-aware state

If the product needs any of the following, backend wallet auth should be added next:

- counting real users
- persistent accounts
- premium access control
- referral systems
- saved watchlists
- wallet-based subscriptions
- abuse prevention

## Current Frontend Files

The current wallet connect logic lives in:

- `client/lib/wallet-session.ts`
- `client/components/app-header.tsx`
- `client/components/landing-page.tsx`

## Proposed Backend API Contract

This section defines a simple contract the frontend and backend teams can share.

The route names are suggestions. The important part is the payload shape and the verification steps.

### Endpoint 1. Request Nonce

Route:

- `POST /api/auth/wallet/nonce`

Purpose:

- create a one-time wallet auth challenge

Request body:

```json
{
  "address": "0x71c1234567890abcdef1234567890abcdef9A4F",
  "chainId": "0x1"
}
```

Backend behavior:

- normalize the wallet address
- generate a random nonce
- set an expiry time such as 5 minutes
- store the challenge server-side
- build the exact message the frontend must ask the wallet to sign

Suggested response:

```json
{
  "nonceId": "0f3a2bb0-49c6-4f8b-a11b-2efb5f0a2f80",
  "address": "0x71c1234567890abcdef1234567890abcdef9A4F",
  "chainId": "0x1",
  "nonce": "915843",
  "issuedAt": "2026-07-12T10:15:00.000Z",
  "expiresAt": "2026-07-12T10:20:00.000Z",
  "message": "Sign in to PITCHLINE\nAddress: 0x71c1234567890abcdef1234567890abcdef9A4F\nChain ID: 0x1\nNonce: 915843\nIssued At: 2026-07-12T10:15:00.000Z\nExpires At: 2026-07-12T10:20:00.000Z"
}
```

Notes:

- the frontend should treat `message` as opaque and sign it exactly as received
- `nonceId` is useful so the backend does not need to search by raw nonce text

### Endpoint 2. Verify Signed Challenge

Route:

- `POST /api/auth/wallet/verify`

Purpose:

- verify wallet ownership and create an authenticated app session

Request body:

```json
{
  "nonceId": "0f3a2bb0-49c6-4f8b-a11b-2efb5f0a2f80",
  "address": "0x71c1234567890abcdef1234567890abcdef9A4F",
  "chainId": "0x1",
  "message": "Sign in to PITCHLINE\nAddress: 0x71c1234567890abcdef1234567890abcdef9A4F\nChain ID: 0x1\nNonce: 915843\nIssued At: 2026-07-12T10:15:00.000Z\nExpires At: 2026-07-12T10:20:00.000Z",
  "signature": "0x..."
}
```

Backend behavior:

- load the stored challenge by `nonceId`
- ensure it exists
- ensure it is not expired
- ensure it has not already been used
- ensure the stored address matches the submitted address
- ensure the stored message matches the submitted message
- recover the signer from the signature
- ensure the recovered address matches the submitted address
- mark the nonce as used
- create or find a user
- create a session or token

Suggested success response for cookie session:

```json
{
  "user": {
    "id": "usr_01k0walletauth",
    "walletAddress": "0x71c1234567890abcdef1234567890abcdef9A4F"
  },
  "authenticated": true
}
```

Suggested success response for token session:

```json
{
  "user": {
    "id": "usr_01k0walletauth",
    "walletAddress": "0x71c1234567890abcdef1234567890abcdef9A4F"
  },
  "authenticated": true,
  "accessToken": "jwt-or-session-token"
}
```

### Optional Endpoint 3. Read Current Session

Route:

- `GET /api/auth/session`

Purpose:

- let the frontend restore authenticated user state on page refresh

Suggested response when signed in:

```json
{
  "authenticated": true,
  "user": {
    "id": "usr_01k0walletauth",
    "walletAddress": "0x71c1234567890abcdef1234567890abcdef9A4F"
  }
}
```

Suggested response when signed out:

```json
{
  "authenticated": false,
  "user": null
}
```

### Optional Endpoint 4. Logout

Route:

- `POST /api/auth/logout`

Purpose:

- destroy the backend session

Important note:

- disconnecting the backend session is different from disconnecting the wallet extension
- most browser wallets do not let the app forcibly disconnect the extension itself

## Recommended Status Codes

Suggested backend responses:

- `200` for success
- `400` for invalid payload
- `401` for invalid signature or unauthenticated session
- `409` for used nonce
- `410` for expired nonce
- `429` for too many auth attempts

## Recommended Backend Storage Model

At minimum the backend should store a wallet challenge record with:

- `nonceId`
- `address`
- `chainId`
- `message`
- `nonce`
- `issuedAt`
- `expiresAt`
- `usedAt`
- `ipAddress?`
- `userAgent?`

The backend should also have a user model or account model with:

- `userId`
- `walletAddress`
- `createdAt`
- `lastAuthenticatedAt`

## Frontend Call Sequence

The frontend sequence should be:

1. Connect the browser wallet with `eth_requestAccounts`.
2. Read the selected address and chain id.
3. Call `POST /api/auth/wallet/nonce`.
4. Receive the backend-generated message.
5. Ask the wallet to sign that message.
6. Call `POST /api/auth/wallet/verify` with the signature.
7. If verification succeeds, mark the app session as authenticated.
8. On future page loads, call `GET /api/auth/session` to restore auth state.

## Frontend Pseudocode

This is the frontend shape, independent of styling.

```ts
async function signInWithWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet found");
  }

  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0];

  const chainId = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;

  const nonceResponse = await fetch("/api/auth/wallet/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chainId }),
  });

  if (!nonceResponse.ok) {
    throw new Error("Failed to create wallet challenge");
  }

  const challenge = await nonceResponse.json();

  const signature = (await window.ethereum.request({
    method: "personal_sign",
    params: [challenge.message, address],
  })) as string;

  const verifyResponse = await fetch("/api/auth/wallet/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonceId: challenge.nonceId,
      address,
      chainId,
      message: challenge.message,
      signature,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error("Wallet verification failed");
  }

  return verifyResponse.json();
}
```

## Frontend State Model Recommendation

It helps to separate two states in the UI:

### Wallet State

This is controlled by the browser wallet.

Examples:

- wallet available
- wallet connected
- wallet address selected
- active chain id

### App Auth State

This is controlled by the backend session.

Examples:

- auth idle
- requesting nonce
- waiting for signature
- verifying signature
- authenticated
- auth failed

This distinction is important because:

- a wallet can be connected while the app session is not authenticated
- a wallet can change accounts after auth
- the backend session can expire while the wallet still appears connected

## UX Cases The Frontend Should Handle

The frontend should expect and handle:

- no wallet extension installed
- user rejects wallet connection
- user rejects signature prompt
- nonce expires before signature is submitted
- account changes after successful auth
- chain changes during auth flow
- backend session expires on refresh

Recommended behavior:

- show clear error copy
- clear auth state when the wallet account changes
- require re-authentication when the connected address changes
- avoid assuming wallet-connected means app-authenticated

## Best Practice Notes

- Prefer backend-issued messages over frontend-generated messages.
- Prefer one-time nonces with short expiries.
- Never trust only the wallet address from the frontend.
- Mark every successful nonce as used immediately.
- Use HTTP-only cookies if you want simpler browser session handling.
- If using JWTs, keep them short-lived and rotate refresh tokens carefully.

## Handoff Summary For Backend Team

Backend team needs to provide:

- `POST /api/auth/wallet/nonce`
- `POST /api/auth/wallet/verify`
- optionally `GET /api/auth/session`
- optionally `POST /api/auth/logout`

Frontend team will:

- connect the wallet
- request the nonce
- request the wallet signature
- submit the signature for verification
- use the returned session to gate product features
