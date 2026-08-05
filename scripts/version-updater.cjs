/**
 * standard-version updater shared by every entry in .versionrc.json bumpFiles.
 *
 * Two shapes have to be handled, because the bump list mixes prose with data:
 *
 *   - "v0.7.3" as it appears in README.md and site/index.html
 *   - "version": "0.7.3" as it appears in docs/capabilities.json and
 *     docs/architecture.json
 *
 * Only the prose form used to be handled, so the two JSON manifests were never
 * bumped and silently fell behind package.json — capabilities.json sat at 0.5.0
 * through the 0.7.x releases, which is exactly the drift the manifest
 * integration test exists to catch.
 */

// A literal v-prefix, as used in prose: "v0.7.3".
const PREFIXED = /v(\d+\.\d+\.\d+)/;

// The first top-level-ish "version" field of a JSON document. Deliberately not
// global: docs/architecture.json carries per-node version fields further down
// that must not be rewritten.
const JSON_FIELD = /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/;

module.exports.readVersion = function (contents) {
  const prefixed = contents.match(PREFIXED);
  if (prefixed) return prefixed[1];

  const jsonField = contents.match(JSON_FIELD);
  return jsonField ? jsonField[2] : null;
};

module.exports.writeVersion = function (contents, version) {
  if (PREFIXED.test(contents)) {
    return contents.replace(new RegExp(PREFIXED.source, 'g'), `v${version}`);
  }

  return contents.replace(JSON_FIELD, `$1${version}$3`);
};
