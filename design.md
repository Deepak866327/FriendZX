# FriendZX — Modern Glassy UI Redesign Brief (`design.md`)

> **Read this entire file before writing any code.** This is the single source of truth for a full visual redesign of the FriendZX frontend. Your job is to migrate styling to **Tailwind CSS** and rebuild every page and component with a modern, **mobile-first, glossy/glassy ("liquid glass") aesthetic** inspired by Instagram, Apple iOS 18, and Linear — while **preserving all existing logic, routing, state, sockets, and data flow**.

---

## 0. Ground rules (read first — do not skip)

1. **This is a styling/UX redesign, not a rewrite.** Do **not** change business logic, API calls, context providers, zustand stores, socket.io wiring, hooks, or routing behavior. Only change markup structure (for layout), `className`s, and add Tailwind + design-system files.
2. **Work on the `frontend/` workspace only.** Do not touch `api-gateway/`, `docs/`, or any backend service.
3. **Preserve all `props`, event handlers, and component public APIs.** If a component is imported elsewhere, its exports and behavior must stay identical.
4. **Mobile-first, always.** Every screen is designed for a 390px-wide phone first, then enhanced upward with Tailwind responsive prefixes (`sm: md: lg: xl:`). This code will later be ported to a mobile app, so treat the phone layout as the canonical design.
5. **Work in phases. Commit after each phase.** Do not attempt all 10 steps in one pass. After each phase, run `npm run build` and `npm run type-check`, fix errors, and stop for review.
6. **Keep accessibility in mind:** semantic HTML, `aria-*` on icon buttons, focus-visible rings, 44px minimum touch targets, and AA color contrast.
7. **Do not delete the old `App.css` until Phase 10** — keep it imported so nothing visually breaks mid-migration; remove dead rules only once a screen is fully migrated to Tailwind.

---

## 1. Current state (so you have full context)

**Stack:** Vite 7 · React 18 · TypeScript · react-router-dom v6 · zustand · leaflet (`@types/leaflet`) · socket.io-client · axios · clsx.
**Styling today:** a single large hand-written `frontend/src/App.css` with CSS custom properties (a *warm dark violet/rose/amber* "dopamine" theme, Space Grotesk + Pacifico + Righteous fonts). **We are replacing this look entirely.**
**Path alias:** `@/` → `frontend/src/`.

**Routing (`frontend/src/App.tsx`):**
- Public: `/login`, `/register`, `/auth/callback`
- Protected (wrapped in `ProtectedLayout` with `<Header/>`, `<BottomActionBar/>`, many context providers): `/dashboard`, `/profile`, `/explore`, `/nearby`, `/messages`, `/feed`
- `/` → redirects to `/dashboard`

**Pages:** `LoginPage`, `RegisterPage`, `AuthCallbackPage`, `DashboardPage`, `ProfilePage`, `ExplorePage`, `NearbyPage`, `MessagesPage`, `FeedPage`.

**Component groups under `frontend/src/components/`:** `Auth/`, `Bluetooth/`, `Call/`, `Challenge/`, `Chat/`, `Common/` (Header, Footer, Modal, BottomActionBar, SearchBar, Loading, Toast, ImageCropper, ShareSheet, CommentsModal, ErrorBoundary), `Community/`, `Cration/`, `Explore/`, `Location/` (LocationMap, NearbyUsers, RadiusMapFilter, SearchLocation, LocationTracker), `Media/`, `Notifications/`, `Posts/` (PostCard, PostFeed, MixedFeed, CreatePostModal, SkeletonCard), `Profile/` (ProfileCard, ProfileEditor, SettingsModal, FollowListModal).

**Contexts to leave untouched:** Auth, Theme, Socket, User, Location, Notification, Chat, Call, Bluetooth, Challenge.

> ⚠️ There is currently **no landing page** — the app drops straight to `/login`. Phase 2 adds one.

---

## 2. Design language & brand direction

**Vibe:** clean, fluid, "liquid glass." Frosted translucent surfaces floating over a soft, calming gradient background, with crisp typography and gentle motion. Think Instagram's clarity + iOS 18's frosted-glass depth + a calm wellness-app palette.

### Color palette — cool, calm, modern
Replace the warm dark theme. Use **soft blues, lavender/purple, and white**, with a light "airy" default theme and an optional dark variant.

```
Brand / primary
  --fx-indigo-600  #4f46e5   (primary actions, links)
  --fx-violet-500  #8b5cf6   (secondary / gradients)
  --fx-sky-400     #38bdf8   (accents, online status)
  --fx-blue-500    #3b82f6

Signature gradient (logo, primary buttons, active states)
  linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #38bdf8 100%)

Neutrals (light theme)
  --fx-bg          #f5f7ff   (page background base)
  --fx-bg-tint     soft radial blobs of #c7d2fe / #ddd6fe / #bae6fd
  --fx-surface     rgba(255,255,255,0.65)   (glass cards)
  --fx-border      rgba(255,255,255,0.55)   (glass edge highlight)
  --fx-text        #1e1b2e
  --fx-text-muted  #6b7280

Status
  online  #22c55e   ·  away #f59e0b  ·  offline #94a3b8
  proximity-near #38bdf8 → proximity-far #a78bfa (use as a scale)
```

### Glassmorphism recipe (the core look — make it a reusable utility)
Every card/sheet/nav surface should be true frosted glass:
- `backdrop-blur-xl` (or `2xl`), semi-transparent white/dark fill (`bg-white/60`, dark: `bg-slate-900/50`)
- 1px translucent border (`border border-white/40`)
- soft layered shadow + a subtle inner top highlight
- generous rounding (`rounded-2xl` / `rounded-3xl`)
- on hover: slight lift (`-translate-y-0.5`), brighter border, stronger shadow
Define this once as a Tailwind component class (e.g. `.glass`, `.glass-strong`, `.glass-nav`) in a base layer so it's consistent everywhere. **Always keep a non-blur fallback** (solid translucent bg) for browsers without `backdrop-filter`.

### Typography
- Primary font: **Poppins** (Google Fonts) for headings + UI. Body can use **Inter** for long text if you prefer better legibility; otherwise Poppins throughout.
- Load via `<link>` in `index.html` (replace the current Pacifico/Righteous links) and set as Tailwind `fontFamily.sans`.
- Type scale: tight, modern. Large friendly headings, comfortable body (15–16px), clear hierarchy.

### Logo
Replace the current text logo (`Freind` + `Z` + `X` spans). Design a **modern wordmark + mark**:
- A clean geometric "FX" / location-pin-with-people glyph rendered as inline **SVG** filled with the signature gradient.
- Wordmark "FriendZX" in Poppins SemiBold; subtle gradient or solid indigo.
- Provide it as a reusable `<Logo />` component in `components/Common/` with `size` and `variant` (full / mark-only / mono) props. Also produce an SVG `favicon` and update `index.html` `<title>` (currently misspelled "FreindZX" → "FriendZX").

### Iconography
Use a single modern icon set. **Add `lucide-react`** and replace ad-hoc SVGs/emojis with consistent line icons (stroke ~1.75). Keep the existing inline Google "G" SVG on the OAuth button.

### Motion
See Phase 8 for the Framer Motion decision. Default to **CSS/Tailwind transitions** for hover/press/focus; reserve Framer Motion for modals, route/page transitions, and list stagger.

---

## 3. The 10-step implementation plan

> Do these **in order**. Each phase ends with: `npm run type-check` + `npm run build` clean, a visual check at 390px / 768px / 1280px, and a commit.

### Phase 1 — Tailwind setup & design tokens
- Install Tailwind: `npm i -D tailwindcss@latest postcss autoprefixer` and init `tailwind.config.js` + `postcss.config.js`. (Tailwind v4 is fine via the Vite plugin `@tailwindcss/vite`; pick one approach and be consistent.)
- Configure `content` to scan `./index.html` and `./src/**/*.{ts,tsx}`.
- Extend the theme with the palette, gradient, `fontFamily.sans = ['Poppins', ...]`, custom `borderRadius`, `boxShadow` (glass shadows), and `backdropBlur` values from Section 2.
- Create `frontend/src/styles/index.css` (or `tailwind.css`) with `@tailwind base; @tailwind components; @tailwind utilities;` and a `@layer components` block defining reusable classes: `.glass`, `.glass-strong`, `.glass-nav`, `.btn-primary`, `.btn-ghost`, `.gradient-text`, `.fx-bg` (the animated soft-blob background), `.avatar-ring`, `.status-dot`.
- Import this stylesheet in `src/index.tsx`/`main` **above** the old `App.css`. Add Poppins to `index.html`; fix the title; add a global smooth-scroll + `selection` color.
- Update `tsconfig`/vite alias only if needed (alias already exists). **Do not restyle components yet** — Phase 1 is plumbing only.

### Phase 2 — Landing page (NEW)
- Create `components/Landing/LandingPage.tsx` and page `pages/LandingPage.tsx`; add a **public route `/`** that renders it (move the old `/`→`/dashboard` redirect to only fire when authenticated). Unauthenticated users hitting `/` see the landing page; authenticated users redirect to `/dashboard`.
- Sections: a glassy sticky top nav (logo + "Log in" / "Sign up" buttons), a **hero** (bold headline like "Find your people, nearby." + subcopy + two CTAs → `/register` and `/login`, plus a floating glass phone mockup showing the feed/map), a "how it works" 3-step strip, a feature grid of glass cards (Nearby discovery, Live map, Challenges, Chat & calls, Communities), social-proof band, and a gradient CTA footer.
- Mobile-first single column; expand to multi-column at `md:`/`lg:`. Soft animated gradient-blob background (`.fx-bg`). Subtle scroll-reveal on sections (Intersection Observer or Framer Motion if adopted in Phase 8).
- **Primary CTA → `/register`, secondary → `/login`.** This is the new front door.

### Phase 3 — Login & Signup redesign
- Restyle `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`, and the `components/Auth/` forms (`LoginForm`, `RegisterForm`, `ForgotPasswordModal`).
- Centered glass auth card floating on the `.fx-bg` gradient; new `<Logo/>` at top; tagline; modern floating-label or cleanly-labeled inputs with focus rings; gradient primary button with press animation; the existing "Continue with Google" button restyled (keep its handler + Google SVG); "OR" divider; link between login/signup; keep the app-store badge row but modernize it.
- Preserve `useAuth`, `navigate`, redirect-if-authenticated logic, and `ForgotPasswordModal` wiring exactly.
- Inline error/success states styled as soft glass toasts/banners (reuse `Notifications/Toast`).

### Phase 4 — Main feed (glassy cards)
- Restyle `pages/FeedPage.tsx`, `pages/DashboardPage.tsx`, and `Posts/` (`PostCard`, `PostFeed`, `MixedFeed`, `CreatePostModal`, `SkeletonCard`) + `Common/CommentsModal`, `ShareSheet`, `Cration/` cards, `Community/CommunityCard`.
- Instagram-style post cards as frosted glass: avatar with gradient story ring + status dot, username + proximity/time meta, media with `rounded-2xl`, action row (like/comment/share/save) with springy tap feedback and animated like, caption, comment preview.
- **Keep real-time updates working** — do not alter socket subscriptions or store updates; only restyle the rendered output. Modernize `SkeletonCard` as a shimmer placeholder. Preserve infinite-scroll / data-fetching hooks.

### Phase 5 — Map / nearby discovery
- Restyle `pages/NearbyPage.tsx`, `pages/ExplorePage.tsx`, and `Location/` (`LocationMap`, `NearbyUsers`, `RadiusMapFilter`, `SearchLocation`, `LocationTracker`) + `Bluetooth/BluetoothDiscovery`.
- Keep **leaflet** as the engine; restyle the chrome around it: glass floating search bar, a glass radius/filter sheet, custom **map markers** = circular avatar pins with gradient ring + pulsing online halo. A bottom **glass draggable sheet** listing nearby friends as horizontal proximity cards (avatar, name, status, "X m away", quick actions). Style leaflet popups/controls to match (custom CSS for `.leaflet-*`). Add a calm map tile feel (or a subtle overlay) but **don't break tile loading or geolocation logic**.
- "Proximity indicator": distance chip + a color scale (near = sky, far = violet) and/or signal-bar glyph.

### Phase 6 — User profile page
- Restyle `pages/ProfilePage.tsx` and `Profile/` (`ProfileCard`, `ProfileEditor`, `SettingsModal`, `FollowListModal`).
- Glass profile header: large avatar with gradient ring + status, name/handle, bio, stats row (posts / followers / following as tappable glass chips opening `FollowListModal`), primary action (Edit / Follow / Message), and a segmented tab control (Posts / Media / Communities) with an animated active indicator. Grid of post thumbnails below. `ProfileEditor` & `SettingsModal` become clean glass modals (see Phase 8 for modal motion). Keep all save/edit handlers intact.

### Phase 7 — Responsive navigation system
- Redesign `Common/Header`, `Common/BottomActionBar`, `Common/Footer`, `Notifications/NotificationBell`/`NotificationPanel`.
- **Mobile (`< lg`):** frosted **bottom tab bar** (`.glass-nav`, safe-area padding `env(safe-area-inset-bottom)`) with 5 items (Feed, Explore/Map, **center Create FAB** as gradient button, Messages, Profile), active state animated, badges on Messages/Notifications. Top header collapses to logo + notification bell + avatar.
- **Desktop (`lg+`):** convert to a **left glass sidebar** (logo, nav items with labels, create button, profile at bottom) and hide the bottom bar; content area gets a max-width centered column. Drive both from the same nav config so routes stay in sync. Preserve all navigation targets and the providers in `ProtectedLayout`.

### Phase 8 — Animations (Framer Motion decision)
**Recommendation: YES, add Framer Motion — but use it sparingly.** It's worth it for this app because of modals, route transitions, and list animations; doing those well by hand is error-prone. Rule of thumb:
- **Tailwind/CSS transitions** for all micro-interactions: hover lift, button press (`active:scale-95`), focus rings, status pulses, skeleton shimmer. (No JS cost.)
- **Framer Motion** for: modal/sheet enter-exit (`AnimatePresence` for `Common/Modal`, `ChatModal`, `CreatePostModal`, `SettingsModal`, `ShareSheet`, bottom sheets), page/route transitions, and staggered feed/list reveals.
- Install `framer-motion`; wrap the shared `Common/Modal` once so every modal inherits consistent spring in/out + backdrop blur fade. Respect `prefers-reduced-motion` (gate animations). Keep durations short (150–300ms) and springy but not bouncy-distracting.
> If, during implementation, you find Framer Motion meaningfully hurts bundle size or the mobile-port target, it's acceptable to fall back to CSS-only transitions + a tiny custom `AnimatePresence`-like helper. Default to keeping it.

### Phase 9 — Responsiveness & cross-device testing
- Audit every screen at **390px (mobile), 768px (tablet), 1024/1280px (desktop)** and a 320px small-phone check. Verify: no horizontal scroll, tap targets ≥44px, safe-area insets on bottom nav, modals/sheets fit small screens, map sheet drag works, text never clips, images use `object-cover` + aspect ratios.
- Test light theme thoroughly; if a dark variant is in scope, verify glass legibility there too. Verify `backdrop-filter` fallback. Fix overflow and z-index layering (nav < modal < toast).

### Phase 10 — Polish & cohesion pass
- Sweep for consistency: spacing scale, radii, shadow depth, gradient usage, icon weights, and that **every** surface uses the shared `.glass*`/`.btn*` classes (no one-off styles). Restyle any stragglers: `Call/` (`CallOverlay`, `CallRequestBanner`), `Challenge/` (`DailyChallengeModal`, `FriendChallengeModal`, `QuestionCard`, `ResultScreen`, etc.), `Chat/` (`ChatList`, `ChatWindow`, `ChatModal`), `Media/` (`MediaUpload`, `CarouselViewer`, `ImageCropper`), `Notifications/Toast`, `Common/Loading` & `SearchBar`.
- **Now remove dead CSS** from the old `App.css` (delete migrated rules; keep only anything still referenced, ideally nothing). Ensure the new `<Logo/>` + favicon are everywhere the old logo was. Final `npm run build`, Lighthouse pass (performance + a11y), and a written summary of what changed per file.

---

## 4. Definition of done
- Tailwind drives all styling; old warm theme fully replaced by the cool glass theme; `App.css` reduced to nothing (or near-nothing).
- New landing page is the public front door → routes to login/signup.
- Every page and component listed in Section 1 is restyled, glassy, mobile-first, and responsive at all breakpoints.
- Poppins typography + new `<Logo/>`/favicon throughout; title fixed to "FriendZX".
- All existing logic, routing, contexts, sockets, zustand, leaflet, and auth flows behave exactly as before.
- `npm run type-check` and `npm run build` pass; reduced-motion respected; AA contrast met.

---

## 5. Constraints checklist (keep re-reading)
- [ ] Only `frontend/` touched. No backend changes.
- [ ] No behavior/logic/prop changes — visual + layout only.
- [ ] Mobile-first; phone layout is canonical (future mobile-app port).
- [ ] Reusable `.glass*` / `.btn*` utilities — no one-off styles.
- [ ] Commit + build-check after every phase; do not batch all 10.
- [ ] Accessibility: semantics, focus rings, 44px targets, contrast, reduced-motion.
