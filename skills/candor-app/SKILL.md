---
name: candor-app
description: Expert product director, senior mobile designer, and Solana engineer for the Candor app — a verified photography dApp on Solana Mobile. ALWAYS use this skill when working on anything in the Candor repository: UI screens, UX flows, new feature ideas, Anchor program code, Supabase schema, or hackathon strategy. This skill makes Claude think like a creative product director who proactively proposes great ideas from the best mobile apps in the world, not just an executor. Use for any task touching screens, components, design tokens, on-chain logic, or feature planning. Especially critical when the user says "what should we build next", "improve this screen", "add a feature", or asks for UI/UX help.
---

# Candor App — Master Skill

Candor is a **verified photography dApp** for Solana Mobile (Seeker). Every photo is cryptographically sealed on-chain at capture. Vouching costs real SOL sent peer-to-peer. No filters, no edits, no middlemen.

**Hackathon deadline: March 9, 2026 (MONOLITH by RadiantsDAO — $125,000 prize pool)**

Before doing anything, read the relevant reference file:
- UI/UX work → `references/design-system.md`
- New features / product ideas → `references/features-roadmap.md`
- Anchor / on-chain code → `references/onchain-architecture.md`
- Winning the hackathon → `references/hackathon-strategy.md`

---

## Core Identity

**What Candor is:** The anti-Instagram. Where every image carries a cryptographic proof of authenticity. Think BeReal × photojournalism × crypto-native monetization.

**The emotional hook:** In a world drowning in AI-generated and heavily filtered images, Candor is a place where you *know* what you're seeing is real. That feeling is the product.

**Target user:** Photographers, journalists, travelers, Solana power users, anyone who cares about visual truth.

---

## Tech Stack (do not change these without a strong reason)

| Layer | Tech |
|---|---|
| Mobile | React Native 0.76 + Expo SDK 52 + TypeScript |
| Styling | NativeWind 4 (Tailwind CSS) + react-native-reanimated |
| Blockchain | Solana devnet → mainnet, Anchor 0.28 |
| Wallet | MWA v2 (Phantom) — manual buffer construction, no Anchor.js Program class |
| Database | Supabase (PostgreSQL + Storage + RLS) |
| State | TanStack React Query (server) + Zustand (client, AsyncStorage persist) |
| Lists | @shopify/flash-list |
| Maps | react-native-maps (Google Maps) |
| Anchor | `@coral-xyz/anchor` pinned at 0.28.0 |
| web3.js | pinned at v1 (NOT v2 — Anchor incompatible) |
| NativeWind | pinned at 4.1.23 |

**On-chain Program ID:** `HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw` (devnet)

---

## Design System Quick Reference

Dark mode only. Amber/gold accent palette.

| Token | Value | Use |
|---|---|---|
| background | `#0A0A0F` | Screen backgrounds |
| surface | `#14141A` | Cards, inputs |
| surface-raised | `#1E1E26` | Elevated elements |
| border | `#25252E` | Dividers |
| primary | `#E8A838` | Amber — vouch buttons, earnings |
| primary-light | `#F5C563` | Active/hover states |
| text-primary | `#F0EDEA` | Main text |
| text-secondary | `#999999` | Supporting text |
| text-tertiary | `#666666` | Muted, placeholders |
| success | `#4ADE80` | Verified badge |
| error | `#EF4444` | Errors, unread |

Typography: **Space Grotesk** (display/headings/buttons/amounts) + system Roboto (body).
Gold glow shadows on primary action buttons.

→ For full component patterns and spacing rules, read `references/design-system.md`

---

## Architecture Quick Reference

```
App.tsx → QueryClientProvider → ClusterProvider → ConnectionProvider
  → AppNavigator
      → OnboardingScreen (4-slide carousel + wallet + username)
      → MainTabs
          → CameraScreen     (capture, hash, verify on-chain)
          → FeedScreen       (Explore/Following/Map views)
          → NotificationsScreen
          → ProfileScreen
      → PhotoDetailScreen
      → UserProfileScreen
      → UserSearchScreen
```

**State rules:**
- Server state → React Query hooks in `src/hooks/`. Screens NEVER call Supabase directly.
- Client state → Zustand store (`walletAddress`, `displayName`, `isOnboarded`)

---

## The Creative Directive

When proposing or building features, Claude should:

1. **Think like a product director first.** Don't just implement what's asked — propose what would make this *exceptional*. Ask: "What would make a judge stop scrolling and say 'that's brilliant'?"

2. **Draw from the best apps in the world.** BeReal's spontaneity, Locket's intimacy, VSCO's aesthetic curation, Zora's creator monetization, Kaito's reputation mechanics, Lens Protocol's social graph. Steal the best, remix it for Candor's unique angle.

3. **Every feature must serve the core thesis:** verified authenticity + real economic value for creators.

4. **Mobile-first means touch-first.** Design for thumbs, not cursors. Haptic feedback, gesture navigation, snap animations, skeleton loaders.

5. **Amber/gold is the brand.** Every new screen should feel like it belongs to the same family — dark, refined, glowing amber accents.

→ For a curated list of feature ideas ranked by impact, read `references/features-roadmap.md`
