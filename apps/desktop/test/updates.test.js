import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  isTrustedInstallerUrl,
  selectAvailableUpdate
} from "../updates.js";

function release(version, options = {}) {
  return {
    draft: Boolean(options.draft),
    prerelease: options.prerelease ?? true,
    html_url: `https://github.com/bagdeabhishek/debabufy/releases/tag/main-${version}`,
    assets: [{
      name: `DeBabufy-${version}-win-x64.exe`,
      browser_download_url:
        `https://github.com/bagdeabhishek/debabufy/releases/download/` +
        `main-${version}/DeBabufy-${version}-win-x64.exe`
    }]
  };
}

test("compares three-part application versions", () => {
  assert.equal(compareVersions("0.2.10", "0.2.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("0.3.0", "1.0.0"), -1);
});

test("selects the newest newer Windows x64 installer", () => {
  const update = selectAvailableUpdate(
    [release("0.2.4"), release("0.3.0"), release("0.2.2")],
    "0.2.3",
    { platform: "win32", arch: "x64" }
  );
  assert.equal(update.latestVersion, "0.3.0");
  assert.match(update.downloadUrl, /DeBabufy-0\.3\.0-win-x64\.exe$/);
});

test("ignores drafts, current versions, foreign URLs, and unsupported systems", () => {
  const draft = release("0.4.0", { draft: true });
  const foreign = release("0.5.0");
  foreign.assets[0].browser_download_url =
    "https://example.com/DeBabufy-0.5.0-win-x64.exe";

  assert.equal(
    selectAvailableUpdate(
      [draft, foreign, release("0.2.3")],
      "0.2.3",
      { platform: "win32", arch: "x64" }
    ),
    null
  );
  assert.equal(
    selectAvailableUpdate([release("0.3.0")], "0.2.3", {
      platform: "linux",
      arch: "x64"
    }),
    null
  );
  assert.equal(isTrustedInstallerUrl(foreign.assets[0].browser_download_url), false);
});
