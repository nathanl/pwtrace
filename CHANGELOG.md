# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-01-30

### Added

- `dom` command: New `--action` flag to show DOM snapshot during the action (the `input@` snapshot), matching the "Action" tab in Playwright Trace Viewer GUI
- `dom` command: Transparency warnings when snapshot fallback occurs (e.g., "Note: before@ snapshot was empty, showing action@ snapshot instead")
- `dom` command: JSON output now includes `fallbackUsed` and `fallbackType` fields to indicate when fallback occurred
- `screenshot` command: New `--list` flag shows all available screenshots for a step with detailed timing information (absolute timestamp, relative timing, position, size, dimensions)
- `screenshot` command: New `--index <N>` flag extracts a specific screenshot by its index number
- `screenshot` command: New `--format` flag for `--list` mode supports `text` (default) and `json` output
- `screenshot` command: Extracted screenshots now use format `step-N-screenshot-M.jpeg` (e.g., `step-2-screenshot-5.jpeg`)

### Changed

- **BREAKING**: `screenshot` command now requires either `--list` or `--index <N>` flag instead of automatically selecting a screenshot. This removes heuristic-based screenshot selection in favor of transparent information exposure.
- **BREAKING**: `screenshot` command: `--step` is now required (was optional when using `--failure`)
- `dom` command: `--action` and `--after` are mutually exclusive
- `dom` command: Improved fallback behavior to prefer action@ snapshot when before@ or after@ snapshots are empty

### Removed

- **BREAKING**: `screenshot` command: Removed `--failure` flag. Users should use `--list` to see available screenshots and choose based on timing.

## [0.1.0] - 2025-01-30

### Added

- Initial release
- `show` command: Overview of trace actions with failures highlighted
- `step` command: Deep dive into specific step with context
- `summary` command: Quick stats for CI logs
- `console` command: Console messages filtering by level
- `dom` command: DOM state and element queries at any step
- `screenshot` command: Extract screenshots at steps or failures
- `network` command: Network request table or JSON output
- JSON output support for most commands
- Test step support via `tracingGroup` metadata
- Security features: zip validation, redaction of sensitive headers, output sanitization
- Environment variables for tuning safety limits

[Unreleased]: https://github.com/nathanl/pwtrace/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nathanl/pwtrace/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nathanl/pwtrace/releases/tag/v0.1.0
