# Mobile layout rules

- **Container:** Every main-route page renders inside `.page-container`: full width, `max-w-7xl`, a flex-column base, and 16px mobile horizontal padding. Breakpoint padding is 24px from `md` upward; avoid route-specific outer margins.
- **Spacing:** Use the `layout-*` Tailwind spacing utilities or standard Tailwind spacing values, which follow the shared 4px/8px scale.
- **Fixed chrome:** `--bottom-nav-height`, `--floating-back-size`, `--safe-top`, and `--safe-bottom` are defined in `src/app/globals.css`. Main-route scroll space reserves the bottom navigation plus the safe area when that navigation is shown; floating-back routes reserve its button at the top.
- **Z-index:** Use the named `z-content`, `z-sticky`, `z-bottom-nav`, `z-floating-back`, `z-toast`, `z-overlay-menu`, and `z-modal` layers from `tailwind.config.ts`; do not add numeric z-index values.
- **Grids and rows:** Use minmax-based grid columns, `min-w-0` for flexible text, and a fixed action column with a gap. Truncate or line-clamp long names, descriptions, labels, and addresses.
- **Media and tables:** Give images a fixed aspect ratio, use `object-cover`/`object-contain`, and keep tables in a local horizontal-scroll wrapper or present them as stacked cards.
- **Mobile sizing:** Use `dvh`/`svh` for viewport-height layouts, keep form fields at least 16px to avoid iOS input zoom, and make interactive targets at least 44px with 8px separation where possible.
- **Overflow and overlays:** Fix the offending child rather than hiding page overflow. Reserve scroll padding for fixed navigation and position mobile toasts above that navigation.
