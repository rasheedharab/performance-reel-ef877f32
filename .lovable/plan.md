
# Goal
Every page in the app works comfortably on phones (≈360–430px), tablets (≈640–1024px), and desktop. Frontend/presentation only — no schema, RPC, or edge function changes.

# Approach

## 1. App shell (`src/components/app-shell.tsx`)
The fixed 240px dark sidebar is the single biggest blocker on phones — it eats the viewport and forces horizontal scroll everywhere.

- Below `md` (≤767px): hide the sidebar; replace with a hamburger button in the top header (`h-12` ink bar) that opens the sidebar inside a `Sheet` (left side) with the same nav items and "Sign out" footer. Close on link click.
- `md` and up (≥768px): keep the current persistent sidebar exactly as it is. No visual change on desktop/large tablet.
- Header: add the hamburger on the left for mobile only, keep REC dot + module label, allow the label to truncate (`min-w-0`, `truncate`).
- Main content: keep `overflow-y-auto`; ensure `min-w-0` is preserved on the flex column so child tables don't push width.

## 2. Page padding scale
Pages currently use `px-8 py-10 max-w-7xl mx-auto`. Replace with a responsive scale across all route files under `src/routes/_authenticated/`:
- `px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-7xl mx-auto`

This is a mechanical pass — only padding tokens change.

## 3. Page-header rows (title + action button)
Most pages use `flex items-start justify-between gap-6 mb-10`. On 360px this clips the H1 and shoves the button off-screen. Apply the responsive-header pattern:

```
grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-8
sm:flex sm:items-start sm:justify-between sm:gap-6 sm:mb-10
```

Add `min-w-0` on the text column, `truncate` (or `break-words` for descriptions) on H1, `shrink-0` on the action button group. Scale H1: `text-2xl sm:text-3xl lg:text-4xl`. Buttons keep their label on `sm+`; on mobile, primary CTA shows icon + short label.

Pages this touches: brands, briefs, angles, scripts, storyboard, generation, edit-room, deliverables, qa, launch, performance, library, wallet, dashboard, admin overview, admin users, admin user detail.

## 4. Cards / lists
- Existing `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` patterns (brands, briefs list, generation board, etc.) already work — verify each and tighten gaps on mobile (`gap-3 sm:gap-4`).
- Convert any 2-up grids that start at `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.
- Stat cards on Dashboard / Admin / Wallet: `grid-cols-2 lg:grid-cols-4` so phones still get a usable 2-up.

## 5. Tables → mobile cards
Tables exist on: briefs list, admin users list, wallet transactions, wallet usage breakdowns, performance metrics, ledger views.

Pattern per table:
- Desktop (`md:`+): keep current `<Table>` markup, wrap in `<div className="hidden md:block overflow-x-auto">`.
- Mobile: render the same rows as a stacked card list (`md:hidden space-y-2`) showing the 3–4 most important fields per row, with a chevron link to detail when applicable.

## 6. Two-column workspaces
Angles, Scripts, Storyboard, Generation, Image Studio, Edit Room, Wallet sidebar+content, Admin user detail all use a fixed two-column layout (sidebar + main, or context panel + editor).

Default rule: stack vertically below `lg` (≤1023px), keep side-by-side at `lg+`.
- Sticky context panels (e.g. Angles "THE BRIEF SAYS", Scripts angle list) become a collapsible section at the top on mobile/tablet, with `lg:sticky lg:top-4` on desktop.
- Coverage trackers / progress strips: become horizontal scroll rows on mobile.

## 7. Forms
`src/components/brand-form.tsx`, `brief-form.tsx`, `style-bible-form.tsx`:
- Field grids `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
- Scene/section headers: scale type, wrap with `flex-wrap`.
- Sticky action bar at bottom on mobile (`Save draft` / `Lock brief`) using `sticky bottom-0` with paper background and a top border, so it's always reachable.
- Color picker swatches: ensure `flex-wrap`.
- File upload tiles: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

## 8. Dialogs / modals / sheets
`CostMeter` dialogs, `GenerateClipDialog`, `GenerateVoiceoverDialog`, `ImageStudio` modal, `LibraryPicker`:
- Dialog content: add `max-h-[90dvh] overflow-y-auto` and `w-[calc(100vw-1rem)] max-w-lg` (or appropriate size) so they fit on small screens.
- Sticky dialog footer for confirm/cancel.
- Library picker grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

## 9. Generation board / Storyboard / Edit Room timeline
These are horizontally dense.
- Shot rows: ensure the row itself wraps (thumb + meta + actions stack on mobile) instead of overflowing.
- Timing strip / progress strip: wrap in `overflow-x-auto` with `min-w-[640px]` inner content so phones can scroll the timeline rather than break layout.
- Version cards inside a shot board: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

## 10. Typography & spacing tokens
- H1 `text-4xl` → `text-2xl sm:text-3xl lg:text-4xl`.
- Section H2 `text-2xl` → `text-xl sm:text-2xl`.
- Reduce default `mb-10`/`gap-8` to `mb-6 sm:mb-10` / `gap-4 sm:gap-6 lg:gap-8` where it's currently fixed.
- `label-mono` stays the same size — already small.

## 11. Auth page (`src/routes/auth.tsx`)
Center card: `w-full max-w-md p-6 sm:p-8`, page padding `px-4`.

## 12. Preview viewport
After implementation, switch the editor preview to mobile so the changes are visible to the user, and mention they can flip between phone/tablet/desktop with the device button.

# Technical details

- No new dependencies. `Sheet` (`src/components/ui/sheet.tsx`) and `useIsMobile` (`src/hooks/use-mobile.tsx`) are already in the project.
- Breakpoints used: `sm` 640, `md` 768, `lg` 1024, `xl` 1280 — Tailwind defaults.
- Use `min-w-0` on every flex/grid child that holds long text (brand names, brief project names, file names) to allow `truncate`.
- Use `shrink-0` on icons, avatars, status chips, action buttons.
- Tables that must remain dense (admin consumption analytics) get `overflow-x-auto` with a fixed minimum width as a fallback.
- No changes to `src/styles.css` tokens, design system, or color usage. No changes to data, RPCs, edge functions, or schema.
- Mechanical pass: I'll work through routes in this order so each commit is self-contained: shell → list pages (brands, briefs, library) → workspaces (angles, scripts, storyboard, generation, edit-room) → wallet → admin → forms & dialogs → auth.

# Out of scope
- New features or copy changes.
- Visual redesign — the look stays identical on desktop.
- Touch-gesture interactions (drag/reorder behavior on touch) beyond what already works.
