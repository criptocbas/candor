# Candor Design System — Full Reference

## Philosophy

Candor's aesthetic communicates: **trust, precision, and value**. It should feel like a premium photojournalism tool crossed with a crypto-native app. Think AP wire service meets Zora.

Dark backgrounds make photography pop. Amber gold communicates value and authenticity (gold = real, genuine). Every element of the UI reinforces that what you're seeing is verified.

---

## Color Tokens (NativeWind / tailwind.config.js)

```js
// These are already configured in tailwind.config.js
colors: {
  background: '#0A0A0F',
  surface: '#14141A',
  'surface-raised': '#1E1E26',
  border: '#25252E',
  primary: '#E8A838',
  'primary-light': '#F5C563',
  'text-primary': '#F0EDEA',
  'text-secondary': '#999999',
  'text-tertiary': '#666666',
  success: '#4ADE80',
  error: '#EF4444',
}
```

**Usage patterns:**
- `bg-background` → every screen root view
- `bg-surface` → cards, photo cards, input fields, modals
- `bg-surface-raised` → buttons, chips, badges, toast notifications
- `border-border` → all dividers, card borders, input outlines
- `text-primary` on `#E8A838` → amber primary actions (vouch button, CTA)
- `text-success` → verified checkmark, confirmed on-chain state

**Never use:** white backgrounds, pure black (`#000000`), any purple/blue gradients

---

## Typography

### Fonts
- **Space Grotesk** — headings, button labels, SOL amounts, verification badges, usernames
- **System (Roboto)** — body copy, captions, timestamps, secondary info

### Scale
```
Display:  Space Grotesk 28-32px, weight 700 — screen titles
Heading:  Space Grotesk 20-24px, weight 600 — section headers
Label:    Space Grotesk 14-16px, weight 600 — buttons, chips, tabs
Body:     Roboto 14-16px, weight 400 — content text
Caption:  Roboto 12px, weight 400 — timestamps, metadata
Micro:    Roboto 11px, weight 400 — tertiary info
```

### SOL amounts
Always use Space Grotesk. Use amber (`text-primary`). Format: `◎ 0.05` for SOL, `$12.40` for USD.

---

## Spacing System

Base unit: 4px. Use multiples of 4.

```
xs:  4px   (tight gaps between icons and text)
sm:  8px   (inner card padding, small gaps)
md:  12px  (standard gaps)
lg:  16px  (card padding, section spacing)
xl:  24px  (screen horizontal padding)
2xl: 32px  (major section separators)
3xl: 48px  (hero areas)
```

Screen horizontal padding: always `px-6` (24px)
Card internal padding: `p-4` (16px)

---

## Component Patterns

### Photo Card
```
- Aspect ratio: 4:3 or square
- Border radius: rounded-xl (12px)
- Border: 1px border-border
- Overlay: gradient from transparent to black (bottom 40%) for metadata
- Bottom overlay content: username, timestamp, vouch count, SOL earned
- Verified badge: top-right corner, gold shield icon + "VERIFIED" text in success green
- On press: scale animation (0.97) with spring physics
- Long press: share sheet
```

### Vouch Button
```
- Background: primary (#E8A838)
- Text: "Vouch" + SOL amount, Space Grotesk 600
- Border radius: rounded-full
- Gold glow shadow: shadowColor: '#E8A838', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
- Press state: scale(0.95) + brightness down
- Success state: animated checkmark, "Vouched!" text
- Disabled (already vouched): bg-surface-raised, border-border, text-tertiary
```

### Verification Badge
```
- Shield icon (Lucide ShieldCheck) in success green
- "VERIFIED ON SOLANA" label, Space Grotesk, 11px
- Background: rgba(74, 222, 128, 0.1), border: rgba(74, 222, 128, 0.3)
- Rounded-full, small padding
- Include Solana logo (small) if possible
```

### Profile Earnings Card
```
- Gold border: border-primary, borderWidth: 1
- Background: surface
- SOL earned: Space Grotesk 32px, text-primary
- USD value: Roboto 16px, text-secondary, underneath
- Animated count-up on mount (react-native-reanimated)
```

### Navigation Tabs
```
- Active tab: amber icon + label, gold underline indicator
- Inactive tab: text-tertiary icons, no label
- Tab bar background: bg-surface with top border
- Icons: Camera (center, larger), Feed (grid), Bell, User
```

### Feed Filter Chips (Explore / Following / Map)
```
- Active: bg-primary, text-background, Space Grotesk 600
- Inactive: bg-surface-raised, text-secondary
- Border radius: rounded-full
- Horizontal scroll, no padding ends
- 8px gap between chips
```

---

## Animation Guidelines

Use `react-native-reanimated` for all animations.

### Principles
1. **Quick in, slow out** — entries feel snappy (200ms), exits feel deliberate (300ms)
2. **Spring physics** over easing curves for interactive elements
3. **One wow animation per screen** — don't animate everything
4. **Haptic feedback** on every consequential action (vouch, verify, follow)

### Key animations
- **Shutter flash:** White overlay fade in/out (150ms) on camera capture
- **Verification pulse:** Ripple effect emanating from verified badge on photo post
- **Vouch ripple:** Gold ripple from vouch button on success
- **Feed card entrance:** Staggered slide-up + fade (each card 50ms delay)
- **Earnings count-up:** Animated number roll on profile mount
- **Double-tap vouch:** Heart burst animation (like Instagram) but in amber/gold

---

## Screen Layout Templates

### Standard Screen
```
SafeAreaView (bg-background)
  StatusBar (light content)
  Header (px-6, py-4, flex-row, justify-between)
    Title (Space Grotesk 24px, text-primary)
    [Action icons]
  Content (flex-1)
```

### Feed Screen
```
SafeAreaView
  Filter Chips (horizontal scroll, px-6, py-3)
  FlashList (no padding, estimatedItemSize=400)
    PhotoCard items
```

### Modal / Bottom Sheet
```
Background: rgba(0,0,0,0.7) blur
Sheet: bg-surface, rounded-t-2xl (24px), pt-3
  Drag handle: w-10, h-1, bg-border, mx-auto, mb-4
  Content: px-6
```

---

## Dark Mode Only

Candor is dark mode only. Never add light mode logic. The dark aesthetic is core to the brand — it makes photos look like they're on display, like a gallery.

---

## React Native Specific

- All shadows: use both `shadow*` props (iOS) AND `elevation` (Android)
- Touchable elements: `Pressable` preferred over `TouchableOpacity`
- Images: `expo-image` for caching/performance (or Image from RN)
- Lists: ALWAYS `FlashList` from `@shopify/flash-list`, never `FlatList` for photo grids
- Safe area: always `SafeAreaView` from `react-native-safe-area-context`
- Keyboard: `KeyboardAvoidingView` with `behavior="padding"` on iOS
