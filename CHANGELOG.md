# Changelog

All notable changes to Zeact will be documented in this file. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-30

### Added

- Added top-center and bottom-center notification placement with safe-area offsets.
- Added brand and neutral visual variants, optional actions, dismiss controls, bounded stacking, and accessible status semantics.
- Added reduced-motion-aware entrance and exit animation for notifications.

## [0.1.1] - 2026-10-24

### Fixed

- Corrected stacked-column pointer hit testing when the responsive SVG is letterboxed inside a wider container.
- Line-chart hover inspection now marks the exact active point with a high-contrast dot and follows the first visible layer consistently.

### Added

- Native `StackedColumnChart` with time windows, exact hover/tap and keyboard inspection, responsive SVG rendering, theme palette overrides, legends, and custom tooltips.
- Configurable stacked-column view-box height for larger, denser dashboard layouts.
- Configurable `hoverPoint` and `hoverPointRadius` options for canvas line charts.

## [0.1.0] - 2026-08-11

### Added

- React 18 hooks for stable callbacks, animation-frame state, visibility, reduced motion, and element measurement.
- Anchored, variable-height chat virtualization with viewport preservation.
- Frame-coalesced quote stores with symbol-level subscriptions.
- Bounded real-time series, interactive canvas charts, and quote timeline hooks.
- Media state, live-edge latency, and decoded-video-frame hooks.
- Interactive demo, TypeScript declarations, ESM and CommonJS builds.

[0.1.0]: https://github.com/Jiupeidun/Zeact/releases/tag/v0.1.0
