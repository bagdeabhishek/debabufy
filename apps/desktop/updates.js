const RELEASES_API =
  "https://api.github.com/repos/bagdeabhishek/debabufy/releases?per_page=20";
const DOWNLOAD_PREFIX =
  "https://github.com/bagdeabhishek/debabufy/releases/download/";
const INSTALLER_PATTERN = /^DeBabufy-(\d+\.\d+\.\d+)-win-x64\.exe$/i;

export function compareVersions(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  if (
    leftParts.length !== 3 ||
    rightParts.length !== 3 ||
    [...leftParts, ...rightParts].some((part) => !Number.isInteger(part) || part < 0)
  ) {
    throw new Error("Only three-part release versions are supported.");
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

export function isTrustedInstallerUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.origin === "https://github.com" &&
      url.href.startsWith(DOWNLOAD_PREFIX) &&
      INSTALLER_PATTERN.test(decodeURIComponent(url.pathname.split("/").at(-1)));
  } catch {
    return false;
  }
}

export function selectAvailableUpdate(
  releases,
  currentVersion,
  { platform = process.platform, arch = process.arch } = {}
) {
  if (platform !== "win32" || arch !== "x64") return null;
  const candidates = [];
  for (const release of Array.isArray(releases) ? releases : []) {
    if (release?.draft) continue;
    for (const asset of Array.isArray(release?.assets) ? release.assets : []) {
      const match = String(asset?.name ?? "").match(INSTALLER_PATTERN);
      if (!match || !isTrustedInstallerUrl(asset?.browser_download_url)) continue;
      if (compareVersions(match[1], currentVersion) <= 0) continue;
      candidates.push({
        currentVersion,
        latestVersion: match[1],
        downloadUrl: asset.browser_download_url,
        releaseUrl: release.html_url,
        prerelease: Boolean(release.prerelease)
      });
    }
  }
  candidates.sort((left, right) =>
    compareVersions(right.latestVersion, left.latestVersion)
  );
  return candidates[0] ?? null;
}

export async function fetchAvailableUpdate({
  currentVersion,
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch
}) {
  if (platform !== "win32" || arch !== "x64") return null;
  const response = await fetchImpl(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `DeBabufy/${currentVersion}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) {
    throw new Error(`GitHub update check returned HTTP ${response.status}.`);
  }
  return selectAvailableUpdate(await response.json(), currentVersion, {
    platform,
    arch
  });
}
