# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-02-18

### Added

- In `show` command, new "Source" column displays source file location (file:line) from test step annotations when available
- In `step` command, source file location now displayed in detail view when available (full path)
- JSON output: `source` field added to action objects in both `show` and `step` commands, containing `file`, `line`, and `column` properties
- New `getTotalDuration()` method on Trace class to calculate total trace duration without double-counting nested actions
- Metadata now includes `monotonicTime` from trace context
- DEVELOPING.md with development workflow, testing, formatting, and publishing instructions

### Fixed

- Screenshot timing calculations now correctly convert wall time to monotonic time, showing accurate relative timestamps (e.g., "37ms after start" instead of huge negative values)
- Total duration in `show` and `summary` commands now calculated as span from first action start to last action end, preventing double-counting of nested `tracingGroup` actions
- Status labels in `step` command now only show "(timeout)" for actual timeout errors, not all error types

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

[Unreleased]: https://github.com/nathanl/pwtrace/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/nathanl/pwtrace/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nathanl/pwtrace/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nathanl/pwtrace/releases/tag/v0.1.0
