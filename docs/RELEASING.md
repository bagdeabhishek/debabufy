# Release pipeline

Every successful push to `main` runs the complete test and deployment-package
pipeline.

## Outputs

The workflow builds a CLI package and two browser-targeted packages:

- `form141-assistant-cli.tgz` — installable Node.js CLI package;
- `tds-26qb-assistant-chrome.zip` — Chrome Web Store upload package;
- `tds-26qb-assistant-firefox.zip` — Firefox Add-ons (AMO) upload package; and
- one SHA-256 checksum file for every package.

The Chrome manifest excludes Firefox-only settings. The Firefox manifest
excludes Chrome-only settings and explicitly declares that the extension
collects no data.

## Where builds appear

Each package and checksum is uploaded as its own GitHub Actions artifact
with 30-day retention. After tests, package verification, production dependency
audit, and Firefox linting pass, the workflow also creates a GitHub prerelease:

```text
main-build-<workflow run number>
```

The prerelease contains the CLI archive, browser ZIPs, and all checksums.
Re-running the same workflow updates that release's assets instead of creating
a duplicate.

## What “deploy ready” means

The CLI archive can be installed with npm. Browser packages have a manifest at
the ZIP root and are ready to upload to the respective browser store. They are
not store-signed and are not automatically published to a store.

- CLI users can run `npm install --global ./form141-assistant-cli.tgz`.
- Chrome users can extract the Chrome ZIP and load it unpacked for testing.
- Firefox users can temporarily load the Firefox package for testing.
- Public Chrome Web Store publication requires Chrome Web Store credentials and
  a separate publish step.
- A directly installable signed Firefox XPI requires AMO signing credentials and
  a separate signing/publish step.

Store credentials are intentionally not present in this repository or workflow.
