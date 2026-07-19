# BidLens V0.2.2 UI Design Contract

Frozen baseline: 2026-07-18 | Source: `v022-ui-ux-prototype.html`

This document is the single source of truth for all visual and structural specifications. The implementation MUST match these values exactly.

---

## Color Tokens

### Light Theme (default)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-app` | `#f6f7f9` | Page background, workbench background |
| `--bg-panel` | `#ffffff` | Cards, panels, nav, dialogs |
| `--bg-subtle` | `#f0f2f5` | Table headers, subtle fills |
| `--bg-hover` | `#e9edf2` | Hover states |
| `--bg-input` | `#ffffff` | Input, textarea backgrounds |
| `--border` | `#dfe3e8` | Default borders |
| `--border-strong` | `#c4cbd4` | Strong borders, file glyphs, drag handles |
| `--text` | `#17202a` | Primary text |
| `--text-2` | `#4c5968` | Secondary text |
| `--text-3` | `#7c8794` | Muted/tertiary text |
| `--accent` | `#315f8f` | Primary accent (steel blue) |
| `--accent-hover` | `#274c73` | Accent hover |
| `--accent-soft` | `#e9eff5` | Accent light background |
| `--added-bg` | `#e5f6ed` | Added/success background |
| `--added-border` | `#a9dbc0` | Added border |
| `--added-text` | `#17633b` | Added text |
| `--deleted-bg` | `#fce9e8` | Deleted/danger background |
| `--deleted-border` | `#efb7b4` | Deleted border |
| `--deleted-text` | `#9d302c` | Deleted text |
| `--modified-bg` | `#fff4d8` | Modified/warning background |
| `--modified-border` | `#edd08b` | Modified border |
| `--modified-text` | `#805b08` | Modified text |
| `--span-bg` | `#e9efff` | Table diff background |
| `--span-border` | `#b9c8f4` | Table diff border |
| `--span-text` | `#3153a1` | Table diff text |
| `--danger` | `#b43a35` | Danger color |
| `--warning` | `#9a6800` | Warning color |
| `--success` | `#24734a` | Success color |
| `--shadow` | `0 8px 24px rgba(25, 34, 45, 0.12)` | Shadow for overlays |
| `--radius` | `4px` | Border radius |

### Dark Theme

| Token | Value |
|-------|-------|
| `--bg-app` | `#151719` |
| `--bg-panel` | `#1d2023` |
| `--bg-subtle` | `#25292d` |
| `--bg-hover` | `#2d3237` |
| `--bg-input` | `#202428` |
| `--border` | `#343a40` |
| `--border-strong` | `#505860` |
| `--text` | `#eef1f4` |
| `--text-2` | `#b8c0c8` |
| `--text-3` | `#89939d` |
| `--accent` | `#8baac8` |
| `--accent-hover` | `#a5bdd5` |
| `--accent-soft` | `#26333f` |
| `--added-bg` | `#173a29` |
| `--added-border` | `#2d6949` |
| `--added-text` | `#7bd6a4` |
| `--deleted-bg` | `#442321` |
| `--deleted-border` | `#7f3f3b` |
| `--deleted-text` | `#f0a09a` |
| `--modified-bg` | `#453816` |
| `--modified-border` | `#77632d` |
| `--modified-text` | `#f1ce72` |
| `--span-bg` | `#243255` |
| `--span-border` | `#435a95` |
| `--span-text` | `#a8bdf3` |
| `--danger` | `#f08c86` |
| `--warning` | `#e4bd60` |
| `--success` | `#7bd6a4` |
| `--shadow` | `0 10px 28px rgba(0, 0, 0, 0.35)` |

---

## Typography

```css
--font: Arial, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
--mono: "Cascadia Mono", "Consolas", monospace;
```

| Element | Font Size | Weight | Line Height |
|---------|-----------|--------|-------------|
| Base | 14px | 400 | 1.5 |
| Brand name | 17px | 700 | - |
| Page title | 24px | 700 | 1.25 |
| Section label | 11px | 700 | - |
| Small text | 12px | 400 | - |
| XS text | 11px | 400 | - |
| Tab text | 11px | - | - |
| Badge text | 11px | 700 | - |

---

## Icon Sizes

| Class | Size |
|-------|------|
| `.icon` (default) | 17x17px |
| `.icon.sm` | 15x15px |
| `.icon.lg` | 22x22px |

Stroke: `width: 2, linecap: round, linejoin: round`

---

## App Shell

```
height: 100%
display: grid
grid-template-rows: 56px minmax(0, 1fr)
min-width: 960px
min-height: 680px
```

### App Bar (56px)
- `display: flex; align-items: center; gap: 10px; padding: 0 18px`
- `background: var(--bg-panel); border-bottom: 1px solid var(--border)`
- Brand: `min-width: 190px`, mark 28x28px, name 17px bold
- Nav buttons: `min-height: 32px`
- Protection badge: `font-size: 12px, color: var(--text-3)`

---

## Buttons

### `.btn` (default)
- `min-height: 34px; padding: 6px 12px; font-size: 13px; font-weight: 600`
- `border: 1px solid var(--border); border-radius: var(--radius)`
- `background: var(--bg-panel); color: var(--text-2)`
- Hover: `background: var(--bg-hover); border-color: var(--border-strong); color: var(--text)`

### `.btn.primary`
- `background: var(--accent); border-color: var(--accent); color: #fff`
- Hover: `background: var(--accent-hover)`

### `.btn.danger`
- `color: var(--danger)`

### `.btn.ghost`
- `border-color: transparent; background: transparent`

### `.btn.active`
- `background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); color: var(--accent)`

### `.icon-btn`
- `width: 34px; height: 34px; display: inline-grid; place-items: center`
- Same border/bg as `.btn`

---

## View: New Compare

### Page
- `max-width: 1120px; padding: 34px 36px 28px`
- `display: flex; flex-direction: column; min-height: 100%`

### Page Head
- Title: 24px bold
- Meta: 12px, `var(--text-3)`

### Compare Grid
- `display: grid; grid-template-columns: minmax(0,1fr) 42px minmax(0,1fr); gap: 12px`

### File Slot
- `min-height: 232px; border: 1px solid var(--border); border-radius: var(--radius)`
- Slot head: `min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--border)`
- Slot content: `flex; align-items: center; gap: 15px; padding: 20px; cursor: pointer`
- File glyph: `48x58px; border: 1px solid var(--border-strong); border-radius: 5px; background: var(--bg-subtle)`
- File name: 15px semibold
- File meta: 12px, `var(--text-3)`
- Dragging state: `border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent)`

### Capability Band
- `padding: 14px 16px; border-top/bottom: 1px solid var(--border); background: color-mix(in srgb, var(--bg-panel) 72%, transparent)`
- Chip: `min-height: 26px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 5px; font-size: 12px`
- Chip.on: `border-color: var(--added-border); background: var(--added-bg); color: var(--added-text)`
- Chip.off: `color: var(--text-3); text-decoration: line-through`

### Advanced Settings
- Toggle: `width: 100%; padding: 11px 0; font-weight: 600`
- Body: `padding: 4px 0 18px`
- Segmented control: `display: inline-flex; padding: 3px; border: 1px solid var(--border); border-radius: 5px; background: var(--bg-subtle)`
- Segment: `min-width: 68px; min-height: 30px; padding: 4px 10px; border-radius: 4px`
- Segment.active: `background: var(--bg-panel); color: var(--text); font-weight: 600`

### Page Actions
- `margin-top: auto; padding-top: 24px; display: flex; justify-content: flex-end; gap: 10px`
- Validation hint: `margin-right: auto; color: var(--text-3); font-size: 12px`

---

## View: Processing

### Page
- `max-width: 820px`

### Task Pair
- `display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; padding: 14px 0 18px; border-bottom: 1px solid var(--border)`

### Phase List
- `list-style: none; margin: 22px 0 0; border-top: 1px solid var(--border)`
- Phase: `min-height: 66px; display: grid; grid-template-columns: 28px minmax(0,1fr) auto; gap: 12px; border-bottom: 1px solid var(--border)`
- Phase indicator: `24x24px; border: 1px solid var(--border-strong); border-radius: 50%`
- Phase.done indicator: `border-color: var(--added-border); background: var(--added-bg); color: var(--added-text)`
- Phase.active indicator: `border-color: var(--accent); color: var(--accent)`

### Footer
- `display: flex; justify-content: space-between; margin-top: 20px`
- Elapsed: `display: inline-flex; align-items: center; gap: 7px`

---

## View: History

### Page
- `max-width: 1240px`

### Toolbar
- Searchbox: `height: 34px; min-width: 250px; border: 1px solid var(--border); border-radius: var(--radius)`

### Data Table
- `width: 100%; border-collapse: collapse; table-layout: fixed`
- `border-top/bottom: 1px solid var(--border); background: var(--bg-panel)`
- Header: `height: 38px; font-size: 11px; font-weight: 700; background: var(--bg-subtle)`
- Row: `height: 64px; cursor: pointer`
- Row hover: `background: var(--bg-hover)`
- Column widths: 38% / 13% / 16% / 18% / 12% / 46px

### Status Badge
- `min-height: 24px; padding: 2px 7px; border: 1px solid var(--border); border-radius: 5px; font-size: 11px; font-weight: 700`
- `.review`: `background: var(--accent-soft); color: var(--accent)`
- `.done`: `background: var(--added-bg); color: var(--added-text); border-color: var(--added-border)`
- `.failed`: `background: var(--deleted-bg); color: var(--deleted-text); border-color: var(--deleted-border)`

### Progress Mini
- Track: `width: 72px; height: 5px; border-radius: 3px; background: var(--border)`
- Fill: `height: 100%; background: var(--accent)`

---

## View: Result (Workbench)

### Overall Grid
```
display: grid
grid-template-rows: 50px 46px minmax(0, 1fr)
background: var(--bg-app)
```

### Taskbar (50px)
- `display: flex; align-items: center; gap: 10px; padding: 0 14px`
- `background: var(--bg-panel); border-bottom: 1px solid var(--border)`
- Title: `font-weight: 700; overflow: hidden; text-overflow: ellipsis`
- Progress: `color: var(--text-3); font-size: 12px; padding-left: 8px; border-left: 1px solid var(--border)`
- Spacer: `flex: 1`

### Filter Bar (46px)
- `display: flex; align-items: center; gap: 7px; padding: 0 14px; overflow: hidden`
- `background: var(--bg-panel); border-bottom: 1px solid var(--border)`
- Filter chip: `min-height: 28px; padding: 3px 8px; border: 1px solid transparent; border-radius: 5px; font-size: 12px`
- Filter chip.active: `border-color: var(--border); background: var(--bg-subtle); color: var(--text); font-weight: 600`
- Filter count: `color: var(--text-3); margin-left: 3px`
- Divider: `width: 1px; height: 22px; background: var(--border)`
- Result count: `color: var(--text-3); font-size: 12px`
- Search: `min-width: 190px; margin-left: auto; height: 30px`

### Work Grid
```
display: grid
grid-template-columns: var(--nav-width) 5px minmax(560px, 1fr) 5px var(--detail-width)
```
Default: `--nav-width: 280px; --detail-width: 320px`

### Nav Panel
```
grid-template-rows: 42px minmax(0, 1fr)
border-right: 1px solid var(--border)
background: var(--bg-panel)
```
- Panel head: `42px; display: flex; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 700`
- Nav collapsed: `--nav-width: 52px; hide content text, flags, panel head span`

### Resizer
- `width: 5px; background: var(--bg-app); cursor: col-resize`
- Hover/dragging: `background: var(--accent-soft)`
- Indicator: `::after { width: 1px; height: 34px; background: var(--border-strong); position: absolute; left: 2px; top: calc(50% - 17px) }`

### Viewport
```
grid-template-rows: 42px minmax(0, 1fr)
background: var(--bg-app)
```
- Viewport toolbar: `42px; display: flex; gap: 8px; padding: 0 10px; border-bottom: 1px solid var(--border); background: var(--bg-panel)`
- Viewport title: `flex: 1; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 700`
- Viewport body: `overflow: auto; padding: 16px`

### Document Grid (paragraph view)
```
display: grid
grid-template-columns: minmax(0,1fr) minmax(0,1fr)
gap: 12px
min-height: 100%
```
- Document pane: `border: 1px solid var(--border); border-radius: 6px; background: var(--bg-panel)`
- Document head: `height: 42px; display: flex; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--border)`
- Document content: `padding: 18px 18px 28px; font-size: 14px; line-height: 1.9`
- Context text: `color: var(--text-3)`
- Current paragraph: `padding: 12px 0; border-top/bottom: 1px solid var(--border)`
- Removed: `background: var(--deleted-bg); color: var(--deleted-text); text-decoration: line-through; padding: 1px 2px`
- Added: `background: var(--added-bg); color: var(--added-text); text-decoration: underline; text-underline-offset: 3px; padding: 1px 2px`
- Source anchor: `18x18px; border-radius: 50%; background: var(--span-bg); color: var(--span-text); font-size: 10px`

### Detail Panel
```
grid-template-rows: 42px 42px minmax(0, 1fr) auto
border-left: 1px solid var(--border)
background: var(--bg-panel)
```
- Detail tabs: `42px; display: flex; padding: 0 8px; border-bottom: 1px solid var(--border)`
- Detail tab: `height: 41px; padding: 0 7px; border: 0; border-bottom: 2px solid transparent; font-size: 11px`
- Detail tab.active: `color: var(--text); border-bottom-color: var(--accent); font-weight: 700`
- Detail scroll: `overflow: auto; padding: 13px`
- Detail section: `padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--border)`
- Section label: `margin-bottom: 8px; color: var(--text-3); font-size: 11px; font-weight: 700`
- Detail row: `min-height: 30px; display: flex; justify-content: space-between; gap: 12px; font-size: 12px`
- Summary box: `padding: 10px; border-left: 3px solid var(--modified-border); background: var(--modified-bg); color: var(--modified-text); font-size: 12px`

### Diff Item (68px)
```
display: grid
grid-template-columns: 4px minmax(0, 1fr) auto
gap: 9px
padding: 8px 8px 8px 6px
min-height: 68px
border: 1px solid transparent
border-radius: 5px
```
- Marker: `width: 3px; border-radius: 2px`
  - modified: `background: var(--modified-border)`
  - added: `background: var(--added-text)`
  - deleted: `background: var(--deleted-text)`
  - uncertain: `background: var(--warning)`
- Badge: `min-height: 20px; padding: 0 5px; border-radius: 4px; font-size: 11px`
  - modified: `bg: var(--modified-bg); color: var(--modified-text); border: var(--modified-border)`
  - added: `bg: var(--added-bg); color: var(--added-text); border: var(--added-border)`
  - deleted: `bg: var(--deleted-bg); color: var(--deleted-text); border: var(--deleted-border)`
  - table: `bg: var(--span-bg); color: var(--span-text); border: var(--span-border)`
- Summary: `font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis`
- Location: `font-size: 11px; color: var(--text-3)`
- Selected: `background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 28%, var(--border))`
- Hover: `background: var(--bg-hover)`

### Review Section (bottom of detail panel)
- `padding: 12px; border-top: 1px solid var(--border); background: var(--bg-panel)`
- Status grid: `display: grid; grid-template-columns: 1fr 1fr; gap: 6px`
- Status button: `min-width: 0; padding-inline: 6px; font-size: 11px`
- Important button: `width: 100%; margin-top: 7px`
- Note textarea: `width: 100%; min-height: 66px; margin-top: 9px; resize: vertical; padding: 8px; border: 1px solid var(--border); border-radius: 5px`
- Save state: `display: flex; align-items: center; gap: 5px; min-height: 20px; margin-top: 4px; font-size: 11px; color: var(--text-3)`

---

## Modal

- Backdrop: `position: fixed; inset: 0; z-index: 80; background: rgba(18, 24, 30, 0.45)`
- Modal: `width: min(720px, calc(100vw - 48px)); border: 1px solid var(--border); border-radius: 6px; background: var(--bg-panel); box-shadow: var(--shadow)`
- Modal.small: `width: min(440px, calc(100vw - 48px))`
- Head: `54px; border-bottom: 1px solid var(--border)`
- Body: `overflow: auto; padding: 18px`
- Actions: `padding: 12px 16px; border-top: 1px solid var(--border)`

---

## Toast

- Position: `fixed; top: 66px; right: 14px; z-index: 120; width: 330px`
- `display: grid; grid-template-columns: 22px minmax(0,1fr) auto; gap: 9px; padding: 11px`
- `border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-panel); box-shadow: var(--shadow)`
- Title: 12px bold
- Message: 11px, `var(--text-3)`
- Auto-dismiss: 5 seconds, max 3 visible

---

## Responsive Breakpoints

### At max-width 1120px
- Detail panel + detail resizer: `display: none`
- Detail toggle button: show in taskbar
- Dimension filter group: `display: none`

### At max-width 1024px
- Page padding: `24px` inline
- Compare grid gap: `8px`
- File slot min-height: `218px`
- Taskbar progress: `display: none`
- Optional filter chips: `display: none`

---

## Accessibility

- Focus: `outline: 2px solid var(--accent); outline-offset: 2px`
- Button disabled: `cursor: not-allowed; opacity: 0.5`
- Reduced motion: `scroll-behavior: auto; animation-duration: 0.01ms; transition-duration: 0.01ms`
- Forced colors: diff markers get `border: 2px solid CanvasText`
