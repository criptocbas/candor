<p align="center">
  <img src="assets/candor-logo.png" alt="Candor" width="120" />
</p>

<h1 align="center">Candor</h1>

<p align="center">
  <strong>Every photo cryptographically sealed on Solana at capture.</strong><br/>
  Verified photography meets peer-to-peer creator monetization.
</p>

<p align="center">
  Built for <a href="https://solanamobile.radiant.nexus">MONOLITH — Solana Mobile Hackathon</a> by RadiantsDAO
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-101%20passing-brightgreen" alt="101 tests passing" />
  <img src="https://img.shields.io/badge/solana-devnet-blueviolet" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/platform-Android-green" alt="Android" />
</p>

---

## The Problem

In 2026, **you can't trust a single image you see online.** AI-generated photos are indistinguishable from real ones. Deepfakes, synthetic media, and filter-heavy edits have eroded all visual credibility. News organizations, social platforms, and individual creators have no reliable way to prove a photo is authentic.

Meanwhile, photographers who capture real moments give their best work to platforms that exploit it — no ownership, no payment, no proof of authorship.

## The Solution

**Candor is a mobile-first dApp where every photo is cryptographically fingerprinted and recorded on-chain the instant you tap the shutter.**

The camera captures → the app computes a SHA-256 hash of the raw image bytes → the hash is submitted to a Solana smart contract → the photo is sealed. Any future modification — even a single pixel — would produce a different hash, instantly detectable.

When someone believes in your photo, they **vouch** for it with real SOL that transfers directly from their wallet to yours. No platform fee. No middleman. No algorithm deciding who gets paid.

**This only works on a device like Seeker.** The combination of camera hardware + wallet signing + Solana's sub-second finality makes Candor impossible on any other platform.

---

## Screenshots

<p align="center">
  <img src="assets/screenshots/intro.png" width="200" />
  <img src="assets/screenshots/pick-username.png" width="200" />
  <img src="assets/screenshots/verification.png" width="200" />
</p>
<p align="center">
  <img src="assets/screenshots/feed.png" width="200" />
  <img src="assets/screenshots/notifications.png" width="200" />
  <img src="assets/screenshots/profile.png" width="200" />
</p>

---

## How It Works

### 1. Capture & Seal

Open the camera, tap the shutter. Behind the scenes:

1. Raw image bytes are read via `expo-file-system`
2. **SHA-256 hash** is computed on-device via `expo-crypto`
3. Optional GPS coordinates are fuzzed to ~100m for privacy
4. Image is uploaded to Supabase Storage
5. The hash is submitted to Solana via the `verify_photo` instruction
6. **MWA (Mobile Wallet Adapter)** opens Phantom for signing
7. On-chain confirmation creates an immutable `PhotoRecord` PDA

The user sees a step-by-step verification animation showing each stage in real-time — hash computation, wallet signing, blockchain broadcast, and on-chain confirmation.

### 2. Vouch with Real SOL

See a photo you trust? **Vouch for it.** Your SOL transfers directly from your wallet to the creator's wallet via a Solana smart contract. One vouch per user per photo, enforced at the PDA level — no gaming the system.

Vouchers put real economic value behind photos they believe in. This creates a trust signal that's impossible to fake.

### 3. Earn & Rise

Every vouch is real money. The **Top Creators leaderboard** ranks photographers by total earnings — a live, transparent economy with no hidden algorithms. Your profile shows total SOL earned across all photos with a live USD conversion.

---

## Technical Architecture

### On-Chain Program (Anchor/Rust)

**Program ID:** [`HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw`](https://explorer.solana.com/address/HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw?cluster=devnet)

| Instruction | Purpose |
|-------------|---------|
| `verify_photo` | Creates a `PhotoRecord` PDA seeded by `[b"photo", creator, image_hash]`. Stores SHA-256 hash, GPS (fixed-point i64), timestamp. Validates timestamp within ±5 minutes of cluster clock. |
| `vouch` | Creates a `VouchRecord` PDA seeded by `[b"vouch", voucher, photo_record]`. Transfers SOL directly from voucher to creator via system program CPI. Enforces: amount > 0, ≤ 5 SOL cap, no self-vouching, one vouch per user per photo (PDA uniqueness). Uses `checked_add` for overflow protection. |

### Transaction Construction

**Manual Anchor buffer construction** instead of the `Program` class — required for MWA compatibility on React Native:

- Instruction discriminators are hardcoded `SHA-256("global:<instruction_name>")[0..8]` prefixes
- GPS stored as fixed-point `i64` (actual × 10⁷) using two's complement encoding for signed values
- Compute budget set on all transactions
- Priority fees set on all transactions for mainnet readiness
- **Zero intermediary** in SOL transfer — direct wallet-to-wallet via system program CPI

### Mobile Client (React Native/Expo)

```
App.tsx
  ErrorBoundary
    QueryClientProvider
      ClusterProvider (Solana RPC)
        ConnectionProvider (web3.js)
          SafeAreaProvider
            AppNavigator
              OnboardingScreen      4-slide carousel + wallet + username
              MainTabs
                CameraScreen        capture, hash, verify on-chain
                FeedScreen          explore / following / map views
                NotificationsScreen vouch & follow alerts
                ProfileScreen       earnings, photos, settings
              PhotoDetailScreen     full photo + vouch + proof
              UserProfileScreen     public profiles
              UserSearchScreen      discover creators
```

### Sealed Pipeline (capture → chain)

```
Camera Capture
  ↓ Read bytes (expo-file-system)
  ↓ SHA-256 hash (expo-crypto)
  ↓ Optional GPS (expo-location, fuzzed to ~111m)
  ↓ Upload image to Supabase Storage
  ↓ Build verify_photo TX (manual Anchor buffer)
  ↓ MWA signs via Phantom
  ↓ On-chain confirmation (Solana devnet)
  ↓ Insert photo record in database
```

### Database (Supabase PostgreSQL)

- **Security-hardened RLS policies**: Direct UPDATE on photos blocked from client — stats managed by triggers
- **Automatic triggers**: Vouch insert → auto-increments `vouch_count` and `total_earned_lamports` (SECURITY DEFINER)
- **Defense in depth**: Self-vouch prevention trigger, self-follow CHECK constraint, unique display names
- **Notification triggers**: Auto-create notifications on vouch and follow events
- **Storage**: Image uploads restricted to approved types via bucket policies

### State Management

| Layer | Technology | Pattern |
|-------|-----------|---------|
| Server state | TanStack React Query | Hooks in `src/hooks/` — screens never call Supabase directly |
| Client state | Zustand + AsyncStorage persist | Wallet address (string), display name, onboarded flag |
| Lists | @shopify/flash-list | Cell recycling for 60fps feed scrolling |
| Animations | react-native-reanimated | Spring physics, staggered entrances, haptic feedback |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.76 + Expo SDK 52 + TypeScript |
| Styling | NativeWind 4 (Tailwind CSS) + react-native-reanimated |
| Blockchain | Solana (devnet → mainnet) + Anchor 0.28 |
| Wallet | Solana Mobile Wallet Adapter (MWA) v2 via Phantom |
| Database | Supabase (PostgreSQL + Storage + Row Level Security) |
| State | TanStack React Query + Zustand |
| Lists | @shopify/flash-list |
| Maps | react-native-maps (Google Maps) |
| Testing | Jest + ts-jest (101 unit tests) |

---

## Screens

| Screen | Description |
|--------|-------------|
| **Onboarding** | 4-slide welcome carousel explaining verification, GPS privacy, and the vouch economy. Wallet connect + username setup. |
| **Camera** | Full-screen viewfinder with amber-accented shutter, front/back toggle, GPS toggle. Fires the sealed pipeline on capture. |
| **Verification Flow** | Step-by-step animation showing hash computation, wallet signing, blockchain broadcast, and on-chain confirmation with haptic feedback at each stage. |
| **Feed** | FlashList with Following/Explore/Map views. Top Creators leaderboard. Double-tap to vouch with gold burst animation. Pull-to-refresh. |
| **Photo Detail** | Full photo with vouch button, boost (custom amount), share, verification proof section (hash, tx, creator, GPS, timestamp), vouch list. |
| **Notifications** | Sectioned by Today/Yesterday/Earlier. Gold-highlighted SOL amounts. Unread indicators via tab badge. |
| **Profile** | Earnings card with gold border, photo grid with verified badges, avatar upload, follower/following counts. |
| **User Profile** | Public profiles with follow/unfollow, earnings, photo grid. |
| **User Search** | Debounced search by display name. |

---

## Design System

Dark mode only. Amber/gold accent palette — communicating trust, authenticity, and value. Photos pop against the dark canvas like artworks in a gallery.

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0A0A0F` | Screen backgrounds |
| `surface` | `#14141A` | Cards, inputs, modals |
| `primary` | `#E8A838` | Amber — vouch buttons, earnings, badges |
| `success` | `#4ADE80` | Verified badge, on-chain confirmed |
| `error` | `#EF4444` | Error states |

Typography: **Space Grotesk** (headings, buttons, amounts) + system Roboto (body).
Gold glow shadows on primary actions. Spring physics on all interactive elements.

---

## Testing

Candor includes a comprehensive test suite with **101 unit tests** covering all Solana-related logic:

```bash
yarn test
```

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `anchor.test.ts` | 20 | Transaction construction, discriminators, buffer layout, account ordering, GPS encoding |
| `cnft.test.ts` | 13 | Bubblegum program IDs, tree authority PDA, mint_v1 discriminator, Borsh serialization |
| `solana.test.ts` | 17 | PDA derivation determinism, seed correctness, curve validation |
| `validation.test.ts` | 23 | Amount bounds, self-vouch prevention, balance checks, timestamp drift, GPS encoding |
| `format.test.ts` | 22 | SOL formatting, USD conversion, address truncation, time display |
| `crypto.test.ts` | 6 | Hash-to-bytes conversion, edge cases |

The test suite caught a real bug during development: BN.js `toArrayLike()` writes the absolute value for negative numbers instead of two's complement. GPS coordinates in the Southern/Western hemispheres were being encoded with the wrong sign. Fixed with `BN.toTwos(64)`.

---

## Security

Candor underwent a full security audit following the [Solana Security Checklist](https://solanacookbook.com) with fixes applied across both the on-chain program and client code:

### On-Chain (Anchor Program)

- **Account validation**: Typed `Account<'info, T>` with `Signer<'info>` — automatic owner and signer checks
- **Reinitialization protection**: Uses `init` constraint (not `init_if_needed`) — prevents account overwrite attacks
- **PDA uniqueness**: Seeds include user-specific keys — no shared PDA vulnerability
- **CPI safety**: `Program<'info, System>` validates CPI target — prevents arbitrary CPI attacks
- **Overflow protection**: `checked_add` on vouch_count and total_earned
- **Data matching**: `has_one = creator` constraint validates creator matches stored PhotoRecord
- **Amount cap**: 5 SOL maximum per vouch, enforced on-chain
- **Timestamp validation**: ±5 minute drift check against cluster clock
- **Self-vouch prevention**: `voucher != photo_record.creator` check

### Client-Side

- **Stale closure fixes**: All `useMemo`/`useCallback` dependency arrays audited and corrected
- **User cancellation handling**: MWA signing rejection detected before retry logic
- **Account owner validation**: `fetchPhotoRecordOnChain` verifies account is owned by program before deserialization
- **Input validation**: Client-side amount and self-vouch checks mirror on-chain constraints
- **Signed integer encoding**: GPS coordinates use `BN.toTwos(64)` for correct two's complement i64

### Database (Supabase)

- **RLS hardened**: Direct UPDATE on photos table blocked — stats managed exclusively by database triggers
- **No callable RPCs**: Vouch stats auto-managed by trigger on INSERT (prevents client-side manipulation)
- **Defense in depth**: Self-vouch prevention at Anchor program, client, AND database levels
- **Notification injection blocked**: Direct INSERT on notifications denied — only triggers create them
- **Self-follow prevention**: CHECK constraint at database level
- **Storage policies**: Upload restricted to image file types only

---

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn Classic (1.x) — npm and pnpm cause issues with Solana Mobile template
- [EAS CLI](https://docs.expo.dev/eas/) for building native APKs
- Phantom wallet app on device/emulator

### Install & Run

```bash
git clone https://github.com/criptocbas/candor.git
cd candor
yarn

# Start dev server (requires custom dev client APK)
npx expo start --dev-client

# Type check
yarn typecheck

# Run tests
yarn test
```

### Build

```bash
# Development APK (with dev tools)
eas build --profile development --platform android

# Preview APK (production-like)
eas build --profile preview --platform android
```

---

## Project Structure

```
candor/
  src/
    screens/           8 screens
    components/        15 components + 8 UI primitives
    hooks/             10 custom hooks
    services/          anchor.ts, solana.ts, supabase.ts, verification.ts
    stores/            Zustand auth store (AsyncStorage persist)
    navigators/        React Navigation v6 (stack + bottom tabs)
    theme/             Color tokens
    types/             TypeScript types mirroring DB schema
    utils/             format, crypto, connection, MWA helpers
    polyfills.ts       Buffer, TextEncoder, crypto shims for React Native
  programs/candor/     Anchor program (lib.rs) — deployed to devnet
  tests/               101 unit tests (Jest + ts-jest)
  supabase/            SQL migrations (5 files including security hardening)
  assets/              App icon, splash screen, logo
```

---

## Why Solana Mobile?

Candor is impossible without Solana Mobile. Here's why:

1. **Camera hardware access** — The hash must be computed from raw camera bytes at capture time. A web app can't guarantee the image wasn't modified before hashing.

2. **MWA (Mobile Wallet Adapter)** — Transaction signing happens natively on-device via Phantom. No browser extensions, no popups, no wallet connect bridges. One tap to sign.

3. **Sub-second finality** — Solana confirms the photo hash on-chain in under a second. Users see real-time blockchain confirmation. This isn't possible on chains with 15+ second block times.

4. **Direct SOL transfers** — Vouch payments go wallet-to-wallet via system program CPI. No smart contract escrow, no token wrapping, no bridges. The simplest possible payment path.

5. **Seeker-native UX** — Haptic feedback on vouch confirmation, amber-accented dark UI optimized for OLED, full-screen camera integration.

---

## License

MIT
