# Candor — Features Roadmap & Creative Ideas

## Creative Framework

When proposing features, always ask:
1. Does this deepen **verified authenticity**? (Candor's core value)
2. Does this create **real economic value** for creators?
3. Is this **mobile-native**? (Not a web app ported to mobile)
4. Does it feel **fresh and surprising** but immediately understandable?

Look at what the best apps do and ask: "what would this look like if it was built on Solana with verified photos?"

---

## Already Built (v1)

- Camera capture with SHA-256 hash → on-chain `verify_photo`
- GPS fuzzing to ~100m precision
- Vouch mechanic (SOL transfer peer-to-peer, one per user per photo)
- Feed (Explore / Following / Map views) with FlashList
- Notifications (vouch + follow alerts)
- Profile with earnings card
- Photo detail with vouch button
- User search and public profiles
- Follow/unfollow system
- Onboarding carousel (4 slides)

---

## Tier 1: High Impact, Hackathon-Ready (build these first)

### 1. Trending / Hot Right Now feed
**Inspired by:** Kaito's yapping leaderboards, Twitter trending
**What:** A "Trending" section in the feed showing photos ranked by vouch velocity (vouches per hour, not total). Refreshes every 15 minutes.
**Why it wins:** Shows real economic activity is happening. Makes the app feel alive.
**Implementation:** Supabase query sorting by recent vouch timestamps. Add a "🔥 Trending" filter chip to FeedScreen.

### 2. Verification Streaks
**Inspired by:** Duolingo streaks, Snapchat streaks
**What:** Show users their streak of consecutive days posting verified photos. Gold flame icon + streak count on profile.
**Why it wins:** Drives daily retention, adds gamification, great demo moment ("I have a 14-day streak!")
**Implementation:** Track last_posted_date in users table. Streak badge on profile and photo cards.

### 3. Photo Collections / Albums
**Inspired by:** VSCO collections, 500px galleries
**What:** Users can create named collections of their verified photos (e.g., "Buenos Aires 2025", "Street Photography"). Collections are shareable.
**Why it wins:** Gives photographers a portfolio use case. Makes Candor feel like a serious tool, not just a social app.
**Implementation:** New `collections` table in Supabase. Collection screen with grid + cover photo.

### 4. Vouch Leaderboard
**Inspired by:** Friend.tech creator rankings, Kaito leaderboards
**What:** Weekly leaderboard of top earners in SOL. Shown on a "Creators" tab or section in Explore feed.
**Why it wins:** Shows real money changing hands. Creates aspiration. Perfect for hackathon demo.
**Implementation:** Supabase view summing vouch amounts per creator per 7 days.

### 5. Seeker Hardware Features (MWA + Device-Specific)
**Inspired by:** The whole point of Solana Mobile
**What:** Use Seeker-specific hardware capabilities:
  - Chassis button → trigger camera + verify in one tap
  - cHAPTIC feedback on vouch confirmation (distinct pattern from regular haptics)
  - Lock screen widget showing latest verified photo from followed creators
**Why it wins:** This is the Solana Mobile hackathon. Judges want Seeker integration. Makes the app feel built FOR the device.
**Implementation:** Check Solana Mobile docs for Seeker-specific APIs. Haptic: `expo-haptics` with `impactAsync(Heavy)` on-chain confirmation.

---

## Tier 2: Differentiating Features (build if time allows)

### 6. "Candor Challenge" — Daily Prompt
**Inspired by:** BeReal's daily notification, PhotoRoulette
**What:** Once a day, all Candor users get a notification: "Today's Challenge: Capture something RED." First verified photo matching the prompt (judged by community vouches) earns a special badge + bonus SOL from a prize pool.
**Prize pool mechanics:** Small portion (0.1%) of every vouch goes into a daily prize pool. Winner takes it.
**Why it wins:** Creates a communal moment. Shows off the economic model. Extremely demo-friendly.

### 7. AI Authenticity Score (display only, no blocking)
**Inspired by:** Originality.ai, C2PA content credentials
**What:** Run an AI detection model on uploaded photos and display a "Authenticity Confidence" score: "98% likely camera-captured". This is SUPPLEMENTARY to the on-chain hash — it's a second layer of confidence.
**Why it wins:** Shows forward thinking about AI-generated content problem. Perfect narrative for 2025/2026.
**Implementation:** Use a lightweight on-device model or an API (e.g., Hive Moderation AI detector). Just display the score, don't gate on it.

### 8. Photo Auctions
**Inspired by:** Foundation.app, Zora
**What:** Creators can list a verified photo for auction. Highest bidder owns a Solana NFT of the verified photo record. The NFT includes the SHA-256 hash, GPS data, and timestamp — provenance built-in.
**Why it wins:** Monetization beyond micro-vouches. Makes Candor a marketplace play.
**Implementation:** New Anchor instruction `create_auction`. Time-limited bidding. Mint NFT to winner via Metaplex.

### 9. Collaborative Verification (Witnesses)
**Inspired by:** Court witness systems, Polymarket
**What:** For high-stakes photos (news events, sports moments), the photographer can request "witnesses" — other nearby Candor users whose own GPS data at the time corroborates the photo location.
**Why it wins:** Insanely powerful for journalism/news use case. No other app does this.
**Implementation:** Time-window GPS matching in Supabase. Witness signature stored alongside PhotoRecord.

### 10. Creator Subscriptions
**Inspired by:** OnlyFans model, Patreon, but peer-to-peer SOL
**What:** Follow + pay a monthly SOL subscription to unlock a creator's private/premium photos. Recurring Solana payments.
**Why it wins:** Sustainable creator economy beyond one-off vouches.

---

## Tier 3: Big Swings (future version, mention in roadmap)

### 11. News Wire Integration
Connect verified Candor photos to journalism platforms (AP, Reuters partners). A photographer at an event can submit their verified photo directly to the wire with provenance intact. Each syndication earns SOL.

### 12. "Proof of Presence" Badges
Location-based achievements. "You verified a photo at Machu Picchu" → NFT badge. 200+ photographers verified photos at the same landmark → collective badge unlocked.

### 13. Multi-Signature Verification
For truly high-stakes moments, require N-of-M witnesses (like a multisig wallet) to collectively attest to a photo's authenticity.

### 14. Photo Insurance / Staking
Photographers stake SOL on their own photos as a bond of authenticity. If proven fake, they lose the stake. If verified, they earn additional yield.

---

## UX Improvements (high impact, low effort)

### Micro-interactions
- Gold particle burst when vouch is confirmed (reanimated)
- Subtle shimmer on verified badge (looping animation)
- Photo cards: slide-from-bottom entrance on first load
- Profile: animated SOL earnings counter rolling up

### Onboarding improvements
- Skip button should be more visible
- Add "What is Solana?" explainer for crypto newcomers
- Demo mode: show a pre-verified photo before wallet connect
- Show sample earnings ("Photographers earned ◎ 4.2 yesterday")

### Feed improvements
- Pull-to-refresh with amber spinner
- "New photos" pill that appears when new content loads (like Twitter)
- Infinite scroll state: skeleton loaders not spinners
- Empty state for Following tab: "Follow creators to see their verified photos"

### Camera improvements
- Live hash preview (show first 8 chars of hash as you frame the shot)
- Countdown timer mode (3-2-1 capture, useful for self-portraits)
- Orientation lock warning
- Low light indicator

### Profile improvements
- Shareable profile card (image export with QR code linking to profile)
- "Copy wallet address" tap shortcut
- Photo grid: masonry layout option vs. square grid

---

## Feature Prioritization for Hackathon

Given the March 9 deadline, prioritize in this order:
1. **Vouch Leaderboard** — shows the economy is real, easy to demo
2. **Trending feed** — makes the app feel alive during judging
3. **Verification Streaks** — memorable, gamified, instant "aha"
4. **Seeker hardware features** — mandatory for Solana Mobile hackathon
5. **Candor Challenge** — if time allows, incredible demo moment

Do NOT try to build auctions or subscriptions before the deadline. Polish what exists, then add one or two of Tier 1.
