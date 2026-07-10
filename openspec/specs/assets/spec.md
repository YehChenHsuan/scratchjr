# Asset System Specification

## Requirements

- Every visible image asset has an owner screen, UI state, exact filename, format, dimensions/viewBox, transparency rule, and safe area recorded in `docs/ASSET_REQUIREMENTS.md`.
- UI icons use SVG where possible and keep artwork at least 10% inside the viewBox.
- Stateful controls use `NameOff.svg`, `NameOn.svg`, and `NamePressed.svg` when those states exist.
- Browser runs must contain no missing image/font requests.
- User-supplied replacement files are validated before replacing tracked assets.

## Acceptance

- Desktop 1440x900, Android tablet 1280x800, and iPad 1366x1024 landscape show no clipping, overlap, or blank controls.
- Home, lobby/settings, editor categories, libraries, paint editor, gesture trainer, and gesture execution states have screenshots and a zero-404 report.

