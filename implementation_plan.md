# Implementation Plan - Premium Hospitality Mobile Design System Upgrade

Upgrade the React Native mobile app inside `/apps/mobile` from low-fidelity wireframes to a premium, high-fidelity hospitality design system inspired by luxury hotel property management systems (e.g., Opera Cloud, Cloudbeds, Mews).

---

## User Review Required

> [!IMPORTANT]
> **Strict Monorepo Scope**:
> All work is strictly isolated within `/apps/mobile`. No backend endpoints, Prisma schemas, or shared types are modified. All API integrations, concurrency locking hooks, and WebSocket real-time triggers remain 100% intact.

---

## Design System Specifications

### 1. Central Color Palette (`/apps/mobile/src/theme/colors.ts`)
A curated slate & indigo/blue hospitality palette with rich semantic colors:

| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `primary` | `#0F172A` (Slate 900) | Deep luxury navy for primary headers, titles, and active tabs |
| `primaryLight` | `#1E293B` (Slate 800) | Dark surface / secondary dark elements |
| `accent` | `#3B82F6` (Blue 500) | Primary CTA buttons, interactive links, selection rings |
| `accentDark` | `#2563EB` (Blue 600) | Button press states and focused borders |
| `accentLight` | `#EFF6FF` (Blue 50) | Highlight backgrounds and subtle tint badges |
| `background` | `#F8FAFC` (Slate 50) | App-wide clean canvas background |
| `surface` | `#FFFFFF` | Clean white card and modal surfaces |
| `border` | `#E2E8F0` (Slate 200) | Subtle container and card divider borders |
| `borderFocus` | `#3B82F6` (Blue 500) | Active input focus border |
| `textPrimary` | `#0F172A` (Slate 900) | High-contrast main text and titles |
| `textSecondary`| `#64748B` (Slate 500) | Subtitles, labels, and metadata |
| `textMuted` | `#94A3B8` (Slate 400) | Placeholder text and secondary timestamps |
| `success` | `#10B981` (Emerald 500)| "Clean" status, 201 Created confirmations, positive balances |
| `successLight`| `#ECFDF5` (Emerald 50)| Success alert background and badge fill |
| `warning` | `#F59E0B` (Amber 500) | "Dirty" status, urgent turnover warnings, pending flags |
| `warningLight`| `#FFFBEB` (Amber 50) | Warning alert background and badge fill |
| `error` | `#EF4444` (Red 500) | "Maintenance", 409 Conflict alerts, validation errors |
| `errorLight` | `#FEF2F2` (Red 50) | Error toast and notification card fill |
| `purple` | `#8B5CF6` (Violet 500) | Channel distribution metrics and OTA indicators |
| `purpleLight` | `#F5F3FF` (Violet 50) | Channel badge backgrounds |

---

## Proposed Changes

### Component 1: Design System & Core UI Components (`/apps/mobile/src`)

#### [NEW] [colors.ts](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/theme/colors.ts) & [theme.ts](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/theme/index.ts)
- Centralize color tokens, shadow presets (`shadows.card`, `shadows.modal`), border radii, and spacing constants.

#### [NEW] [Card.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/Card.tsx) & [MODIFY] [WireframeBox.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/WireframeBox.tsx)
- Premium white surface (`#FFFFFF`), `borderRadius: 14`, thin border (`#E2E8F0`), and smooth cross-platform drop shadows (`elevation: 3` for Android, `shadowColor: '#0F172A'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.06`, `shadowRadius: 10` for iOS/web).
- `WireframeBox` will act as a drop-in alias/wrapper for backwards compatibility.

#### [NEW] [PrimaryButton.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/PrimaryButton.tsx) & [MODIFY] [WireframeButton.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/WireframeButton.tsx)
- Refactor into modern, touch-friendly buttons with `borderRadius: 10`, `paddingVertical: 14`, `paddingHorizontal: 20`, and `activeOpacity: 0.85`.
- Support multiple variants:
  - `primary`: Accent Blue (`#3B82F6`) with white bold text.
  - `dark`: Slate 900 (`#0F172A`) with white bold text.
  - `secondary`: White background with Slate 200 border and Slate 900 text.
  - `success`: Emerald (`#10B981`) for high-speed operational actions like "Mark as Clean".
  - `danger`: Red (`#EF4444`) for critical or rollback actions.
- Support `loading` state with an integrated `ActivityIndicator`.

#### [NEW] [StyledInput.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/StyledInput.tsx) & [MODIFY] [WireframeInput.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/WireframeInput.tsx)
- Modern soft background (`#F1F5F9`), subtle border (`#E2E8F0`), `borderRadius: 10`, and comfortable padding.
- Clean typography hierarchy with uppercase tracking on labels (`#64748B`) and inline error text in Red (`#EF4444`).

#### [NEW] [Badge.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/Badge.tsx)
- Pill-shaped status badge with distinct semantic styling:
  - `Clean`: Emerald fill (`#ECFDF5`), emerald text (`#059669`).
  - `Dirty`: Amber fill (`#FFFBEB`), amber text (`#D97706`).
  - `Maintenance`: Red fill (`#FEF2F2`), red text (`#DC2626`).
  - `Inspecting`: Blue fill (`#EFF6FF`), blue text (`#2563EB`).
  - `Confirmed`: Emerald fill (`#ECFDF5`), emerald text (`#059669`).

#### [MODIFY] [Header.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/components/Header.tsx)
- Upgrade to a luxury hotel PMS app bar with clean typography, property brand monogram badge, and sleek back button.

---

### Component 2: Dashboard & Checkout Upgrade (`/apps/mobile/src/screens`)

#### [MODIFY] [DashboardScreen.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/screens/DashboardScreen.tsx)
- **Search Date Card**: Refactor into a clean card with side-by-side date inputs and a modern `PrimaryButton`.
- **Room Inventory List**:
  - Transform each room into a luxury card.
  - Large bold Room Number (`Room 501`).
  - Prominent Nightly Rate (`$200.00` in large bold font with `/ night` muted subtext).
  - Status pill badge (`Clean` / `Dirty` / `Maintenance`).
  - Room category description and property location subtitle.
  - Modern "Book This Room" CTA button.

#### [MODIFY] [CheckoutScreen.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/screens/CheckoutScreen.tsx)
- **Digital Receipt Folio Card**:
  - Present reservation breakdown with itemized rows, room details, duration in nights, and highlighted total sum.
- **Floating Toast Notifications**:
  - `201 Created`: Modern green card with checkmark icon and clear PostgreSQL ACID confirmation text.
  - `409 Conflict`: Modern rose/red card detailing the row-level pessimistic concurrency lock intervention.
- **Bottom Checkout Button**:
  - Full-width, prominent CTA button with loading spinner during transaction locking.

---

### Component 3: Housekeeping Portal Upgrade (`/apps/mobile/src/screens`)

#### [MODIFY] [HousekeepingScreen.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/screens/HousekeepingScreen.tsx)
- **High-Speed Operational Design**:
  - Large, high-contrast room numbers so staff can quickly scan rooms on mobile.
- **Urgent Dirty Room Indicator**:
  - "Dirty" rooms feature an accent left border (`borderLeftWidth: 5`, `borderLeftColor: '#F59E0B'`) and warning badge.
- **"Mark as Clean" Action Button**:
  - Vibrant Emerald (`#10B981`) primary button with instant loading feedback.
- **Live WebSocket Toast**:
  - Anchored floating banner with pulsing green status dot for real-time room status broadcasts.

---

### Component 4: Invoicing, Channel Manager & Navigation Polish (`/apps/mobile/src`)

#### [MODIFY] [InvoiceScreen.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/screens/InvoiceScreen.tsx)
- Digital receipt aesthetics for folio breakdown, ancillary add-on cards, dynamic tax percentage calculations, and payment status badges.

#### [MODIFY] [ChannelManagerScreen.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/screens/ChannelManagerScreen.tsx)
- Premium CRS dashboard with metric cards, connected OTA status indicators (Expedia, Booking.com, Airbnb, Agoda), and real-time ARI sync logs.

#### [MODIFY] [Navigator.tsx](file:///d:/shubham%20mama%20work/pms-app/apps/mobile/src/navigation/Navigator.tsx)
- Upgrade the portal bar to a modern segmented control with active pill indicator and smooth typography.

---

## Verification Plan

### Automated & Static Verification
1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit --project apps/mobile/tsconfig.json
   ```
2. **Metro Export Bundling**:
   ```bash
   npx expo export --no-bytecode
   ```
3. **Mobile E2E Integration Test**:
   ```bash
   npm run test:e2e --workspace=@hotel-pms/mobile
   ```

### Visual Verification
- Verify running Expo app (`npm run start -w @hotel-pms/mobile`) renders without errors and hot-reloads the high-fidelity UI cleanly on mobile.
