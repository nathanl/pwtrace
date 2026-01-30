# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING**: `screenshot` command now requires either `--list` or `--index <N>` flag instead of automatically selecting a screenshot. This removes heuristic-based screenshot selection in favor of transparent information exposure.
- `screenshot` command: `--step` is now required (was optional when using `--failure`)

### Removed

- **BREAKING**: `screenshot` command: Removed `--failure` flag. Users should use `--list` to see available screenshots and choose based on timing.

### Added

- `screenshot` command: New `--list` flag shows all available screenshots for a step with detailed timing information (absolute timestamp, relative timing, position, size, dimensions)
- `screenshot` command: New `--index <N>` flag extracts a specific screenshot by its index number
- `screenshot` command: New `--format` flag for `--list` mode supports `text` (default) and `json` output
- `screenshot` command: Extracted screenshots now use format `step-N-screenshot-M.jpeg` (e.g., `step-2-screenshot-5.jpeg`)

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

[Unreleased]: https://github.com/yourusername/pwtrace/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/pwtrace/releases/tag/v0.1.0
