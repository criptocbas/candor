# Candor — Solana Mobile Photo Verification dApp

React Native (Expo SDK 52) + TypeScript mobile app where every photo is cryptographically verified on-chain (Solana/Anchor) and every appreciation ("vouch") costs real SOL. Built for the Solana Mobile MONOLITH hackathon (deadline: March 9, 2026).

## Commands

- **Dev server**: `npx expo start --dev-client` (requires custom dev client APK on device/emulator)
- **Type check**: `npx tsc --noEmit`
- **Build dev APK**: `eas build --profile development --platform android`
- **Build preview APK**: `eas build --profile preview --platform android`
- **Install deps**: `yarn` (must use Yarn Classic 1.x — npm/pnpm cause issues with Solana Mobile template)

There is no test suite, linter, or formatter configured.

## Architecture

```
src/
  screens/         6 screens (Onboarding, Camera, Feed, Profile, PhotoDetail, UserProfile)
  components/      7 reusable UI components + FeedMap + cluster data access
  hooks/           6 custom hooks (useWallet, useCamera, useVerification, useVouch, usePhotos, useEarnings)
  services/        4 service modules (supabase, solana, anchor, verification)
  stores/          1 Zustand store (authStore — persisted to AsyncStorage)
  utils/           5 utilities (crypto, format, ConnectionProvider, useAuthorization, useMobileWallet)
  types/           Shared TypeScript types mirroring DB schema + nav params
  theme/           Color constants
programs/candor/   Anchor program source (lib.rs) — deployed to devnet
supabase/          SQL migrations
```

### Provider hierarchy (App.tsx)

```
QueryClientProvider → ClusterProvider → ConnectionProvider → SafeAreaProvider → AppNavigator
```

Polyfills (`src/polyfills.ts`) MUST be imported first in App.tsx — Buffer, TextEncoder, crypto shims for React Native.

### Navigation (React Navigation v6)

```
NavigationContainer
└── Stack.Navigator
    ├── if !isOnboarded → OnboardingScreen
    └── if isOnboarded
        ├── MainTabs (Bottom Tabs: Camera | Feed | Profile)
        ├── PhotoDetail (pushed on stack from Feed or Profile)
        └── UserProfile (pushed on stack from Feed, PhotoDetail, or UserProfile)
```

Auth gate is driven by `useAuthStore((s) => s.isOnboarded)` — a persisted boolean, not a token.

### State management — two layers

- **Server state**: `@tanstack/react-query` — all Supabase queries go through hooks in `src/hooks/`. Screens never call Supabase directly.
- **Client state**: Zustand with AsyncStorage persist (`src/stores/authStore.ts`) — stores walletAddress (string, not PublicKey), displayName, isOnboarded. No other stores exist.

### Data flow for core features

**Capture & Verify (sealed pipeline):**
Camera capture → read bytes via expo-file-system → SHA-256 via expo-crypto → optional GPS (fuzzy ~111m) → build Anchor `verify_photo` tx → MWA signs → on-chain confirmation → upload image to Supabase Storage → insert photo row in DB

**Vouch:**
Confirmation dialog → Build Anchor `vouch` tx (SOL transfer from voucher to creator) → MWA signs → on-chain → insert vouch row in DB → call `increment_vouch` RPC

## On-Chain Program (Anchor)

- **Program ID**: `HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw` (devnet)
- **Module name**: `candor_program` (must match for discriminator computation)
- **Two instructions**: `verify_photo` and `vouch`
- PDA seeds: photo = `[b"photo", creator, image_hash]`, vouch = `[b"vouch", voucher, photo_record]`
- GPS stored as fixed-point i64 (actual * 1e7)
- SOL goes directly from voucher to creator (no vault/escrow)
- One vouch per user per photo enforced by PDA uniqueness

### Anchor client (src/services/anchor.ts)

Uses **manual buffer construction** instead of Anchor.js `Program` class — required for MWA compatibility. Instruction discriminators are hardcoded SHA-256 prefixes:
- `verify_photo`: `[0xa6, 0x53, 0x75, 0xc7, 0xc3, 0x30, 0xad, 0x44]`
- `vouch`: `[0x57, 0xf0, 0x08, 0x15, 0xdb, 0xb3, 0xf2, 0xb1]`

Discriminators are computed as `SHA-256("global:<snake_case_instruction_name>")[0..8]`.

## Database (Supabase)

- **URL**: `https://stbzvkylipcrtmrnyzhg.supabase.co`
- **Tables**: `users` (wallet_address UNIQUE, display_name UNIQUE), `photos` (with creator FK), `vouches` (UNIQUE on photo_id + voucher_wallet)
- **Storage bucket**: `photos` (public read)
- **RLS**: All tables have permissive policies for `anon, authenticated` roles (no auth tokens — wallet-based identity)
- **Triggers**: `link_photo_creator` and `link_voucher_user` auto-populate FK IDs from wallet addresses
- **RPC**: `increment_vouch(photo_id, amount)` — atomic update of vouch_count + total_earned_lamports
- Supabase joins use FK column names: `users!creator_id(*)`, NOT `users!creator_wallet(*)`

## Key Gotchas

- **Yarn only**: Must use Yarn Classic 1.x. npm/pnpm break the Solana Mobile template.
- **Anchor 0.28.0**: Pinned for React Native compatibility. Do not upgrade.
- **@solana/web3.js v1**: Anchor doesn't support v2. Do not upgrade.
- **No android/ directory**: Expo managed workflow — native code generated by EAS at build time. No build.gradle, Theme.kt, or XML resources in the repo.
- **MWA transaction signing**: Must use `transact()` wrapper from `useMobileWallet` — each wallet interaction opens a session to Phantom.
- **PublicKey not serializable**: Auth store persists walletAddress as a string. `useWallet` reconstructs PublicKey from it via `useMemo`.
- **PROGRAM_DEPLOYED check**: `useVerification.ts` compares PROGRAM_ID against System Program — if placeholder, skips on-chain tx.
- **Image hashing**: Hashes the base64 string representation (not raw bytes). Deterministic for the same file.
- **Location is opt-in**: Default OFF. When enabled, coordinates are fuzzed to ~111m (3 decimal places) via `fuzzyCoord()`.
- **Feed query joins**: `users!creator_id(*)` — uses the FK column, not the wallet column.
- **hasVouched in FeedScreen**: Uses `useUserVouchedPhotoIds` hook to check vouches table for current user.
- **Vouch confirmation**: Both FeedScreen and PhotoDetailScreen show an Alert before sending SOL.
- **Feed map view**: Toggle between list/map on FeedScreen. Map uses `react-native-maps` (requires Google Maps API key in app.json and native EAS build).
- **Welcome carousel**: 4-slide onboarding carousel explains verification, GPS privacy, and vouching before wallet connect.
- **Public user profiles**: Tapping creator names navigates to read-only UserProfileScreen.
- **Pull-to-refresh**: Available on Feed and Profile screens.

## Code Style

- TypeScript strict mode, 2-space indentation, double quotes, semicolons always
- Named exports for all components, hooks, and utilities (no default exports except App)
- Hooks return objects (not arrays): `const { data, isLoading } = useFeedPhotos()`
- Components use `function` declarations: `export function PhotoCard() {}`
- NativeWind `className` for styling; inline `style` only when values are dynamic
- All async functions use try-catch with `console.error` + either Alert.alert (user-facing) or error state
- React Query keys follow `["entity", "scope", id?]` pattern: `["photos", "feed"]`, `["photos", "user", wallet]`

## Design System

Dark mode only. Color tokens defined in both `src/theme/colors.ts` (for programmatic use) and `tailwind.config.js` (for NativeWind classes):

| Token | Hex | Usage |
|-------|-----|-------|
| background | #0A0A0F | Screen backgrounds |
| surface | #14141A | Cards, inputs |
| surface-raised | #1E1E26 | Elevated elements |
| border | #25252E | Dividers |
| primary | #E8A838 | Amber accent — vouch button, badge, earnings |
| primary-light | #F5C563 | Active/hover states |
| text-primary | #F0EDEA | Main text |
| text-secondary | #999999 | Supporting text |
| text-tertiary | #666666 | Muted text, placeholders |
| success | #4ADE80 | Verified green |
| error | #EF4444 | Error states |

Typography: System default (Roboto on Android). No custom fonts bundled.

## Key Dependencies

| Package | Version | Why pinned/notable |
|---------|---------|-------------------|
| @coral-xyz/anchor | 0.28.0 | MUST pin — only version compatible with RN |
| @solana/web3.js | ^1.78.4 | MUST stay on v1 — Anchor incompatible with v2 |
| nativewind | ^4.1.23 | Requires react-native-worklets + reanimated |
| react-native-worklets | ^0.7.2 | Required by NativeWind's CSS interop babel plugin |
| expo-camera | ~16.0.18 | Tied to Expo SDK 52 |
| zustand | ^5.0.11 | Persist middleware uses AsyncStorage |
| react-native-maps | ^1.27.1 | Google Maps for feed map view; requires EAS build |

## Skills

**Always read the master skill before starting any task:**
`skills/candor-app/SKILL.md`

The master skill routes to the correct reference file depending on the task:

- **UI/UX work** (screens, components, styling, animations) → `skills/candor-app/references/design-system.md`
- **New features or product ideas** → `skills/candor-app/references/features-roadmap.md`
- **On-chain / Anchor code** → `skills/candor-app/references/onchain-architecture.md`
- **Hackathon strategy or submission** → `skills/candor-app/references/hackathon-strategy.md`

The skill contains Candor's full design system, animation patterns, component templates, feature roadmap, Anchor patterns, MWA gotchas, and hackathon judging criteria. It is the source of truth for how the app should look, feel, and be built.