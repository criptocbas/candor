# Candor — Hackathon Strategy

## Competition Details

- **Hackathon:** MONOLITH by RadiantsDAO + Solana Mobile
- **Deadline:** March 9, 2026
- **Prize pool:** $125,000+
- **Platform:** Solana dApp Store (Seeker device)
- **URL:** solanamobile.radiant.nexus

---

## Judging Criteria (from MONOLITH + previous Solana Mobile Hackathon)

1. **Technical Depth** — Quality and complexity of code, evidenced via GitHub commits
2. **Mobile Optimization** — Utilizes mobile-specific features, optimized mobile UX
3. **Creative Solana Usage** — Innovative ways the app interacts with Solana network
4. **Vision and Clarity** — Presentation communicates purpose, potential, and roadmap

Previous winners demonstrated: deep Solana integration, mobile-focused device capabilities, SMS/MWA integration, and diverse category innovation.

---

## Where Candor Is Strong

✅ **Technical depth is excellent** — Anchor program, MWA manual buffer construction, SHA-256 on-chain hashing, PDA-enforced constraints. Commit history shows real engineering work.

✅ **Creative Solana usage** — Peer-to-peer vouch payments with no intermediary is a genuine crypto-native mechanic. Not just "we use a wallet for login."

✅ **Mobile-native concept** — Camera + on-chain hash at capture is ONLY possible on mobile. This couldn't be a web app.

✅ **Strong narrative** — "Every photo cryptographically sealed at capture" is instantly understandable and timely (AI-generated imagery problem).

---

## Where to Improve Before March 9

### Must-Fix (critical for judging)

1. **Live data during demo** — Make sure the vouch economy looks active. Seed the app with real vouches before submission. Judges need to see SOL moving, not zero-state screens.

2. **Onboarding flow** — Judges will download and open the app cold. The first 60 seconds must be magical. Test it with someone who has never seen it. Polish every onboarding slide.

3. **Performance** — FlashList must scroll at 60fps. No janky animations. Test on a physical Android device (Seeker is Android).

4. **Error states** — Every error must be user-friendly. "Transaction failed" is unacceptable. "Photo couldn't be verified — check your wallet balance and try again" is good.

### Should-Fix (differentiates from other submissions)

5. **Seeker hardware features** — At minimum: haptic feedback on vouch confirmation. Ideally: chassis button support, if Seeker SDK exposes it.

6. **One "wow" screen** — Pick the most impressive screen (probably Feed or Photo Detail) and make it visually stunning. Judges screenshot things.

7. **Empty states** — Every empty state should be beautiful and explain what to do next.

---

## Demo Strategy

The demo video/presentation is critical. Structure it like this:

### Hook (0-15 seconds)
Show the problem: "In a world of AI-generated and filtered images, how do you know what's real?"

### Solution (15-45 seconds)
Open the camera → tap shutter → show the hash computation → show the on-chain transaction → the verification badge appears. REAL SOL transaction. Real Solana. Real time.

### Economy (45-75 seconds)
Someone sees the photo → taps Vouch → SOL transfers directly. No platform fee. No middleman. Show the creator's earnings ticking up.

### Scale (75-90 seconds)
Show the Vouch Leaderboard (if built). Show trending photos. This is what a real creator economy looks like.

### Roadmap (90-120 seconds)
Briefly mention Tier 2-3 features: Candor Challenges, News Wire integration, Creator Subscriptions. Show you're building a platform, not just a hackathon project.

---

## Narrative Angles for Submission

**The AI age problem:** Every image online is suspect in 2026. Candor solves this at the hardware level — the camera IS the notary.

**The creator problem:** Photographers give their best work to Instagram for free. Candor routes real money directly to creators with no middleman.

**The Solana Mobile angle:** This only works on a device like Seeker. The combination of camera hardware + wallet + Solana's speed makes this impossible on any other platform.

**The timing:** Content authenticity is a massive unsolved problem. Candor is the first mobile-native solution with real economic stakes (vouchers put SOL on the line for photos they believe in).

---

## Competitive Differentiation

Other hackathon apps are likely:
- DeFi tools (swap aggregators, yield optimizers)
- Gaming apps
- Payment apps

Candor is in a **unique category**: verified social media with crypto-native monetization. The only competitor reference point is Zora (NFT photos) but Candor's vouch mechanic is more social and accessible.

Lead with the uniqueness: **"There is no other app that does what Candor does."**

---

## Technical Credibility Signals for Judges

When writing the submission README / description, mention:
- Manual Anchor buffer construction (not Anchor.js Program class) for MWA compatibility
- SHA-256 image hash computed on-device before upload (image never leaves device unverified)
- PDA-enforced one-vouch-per-user constraint at smart contract level
- GPS fuzzing algorithm (privacy-preserving location proof)
- Zero intermediary in SOL transfer — direct wallet-to-wallet via system program CPI

These are the kinds of details that signal to technical judges: "this team knows what they're doing."
