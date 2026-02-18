# Releasing pwtrace

## Steps

1. **Check unreleased changes** in `CHANGELOG.md` and determine version bump (major/minor/patch)

2. **Update `CHANGELOG.md`**:
   - Create new section: `## [X.Y.Z] - YYYY-MM-DD`
   - Move items from `## [Unreleased]` into new section
   - Update comparison links at bottom

3. **Verify tests pass**: `npm test`

4. **Use npm version to automate commit, tag, and version bump**:

   ```bash
   npm version <major|minor|patch>
   ```

   This updates `package.json`, commits with message "X.Y.Z", and creates tag vX.Y.Z

5. **Push to GitHub**: `git push origin main --tags`

6. **Publish to npm**:
   ```bash
   npm login  # if needed
   npm publish
   ```

## Notes

- Uses [Semantic Versioning](https://semver.org/)
- `npm publish` runs tests automatically via `prepublishOnly` script
- Verify at: npm.com/package/pwtrace and github.com/nathanl/pwtrace/releases
