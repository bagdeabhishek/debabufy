const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
];

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNumber(value) {
  const normalized = String(value).toLowerCase().slice(0, 3);
  const index = MONTHS.indexOf(normalized);
  return index < 0 ? null : index + 1;
}

export function parseCalendarDateLabel(value) {
  const label = String(value ?? "").trim();
  const iso = label.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dayFirst = label.match(
    /\b(\d{1,2})(?:\s+|[-/.])([A-Za-z]+)(?:\s+|[-/.])(20\d{2})\b/
  );
  if (dayFirst) {
    const month = monthNumber(dayFirst[2]);
    return month == null
      ? null
      : isoDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  const monthFirst = label.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(20\d{2})\b/);
  if (monthFirst) {
    const month = monthNumber(monthFirst[1]);
    return month == null
      ? null
      : isoDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }
  return null;
}

export function parsePortalInputDate(value) {
  const input = String(value ?? "").trim();
  const parsedLabel = parseCalendarDateLabel(input);
  if (parsedLabel) return parsedLabel;
  const dayFirst = input.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  return dayFirst
    ? isoDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
    : null;
}

export function nearestDateInSameMonth(targetIso, candidateDates) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(targetIso))) return null;
  const targetTime = Date.parse(`${targetIso}T00:00:00Z`);
  if (!Number.isFinite(targetTime)) return null;
  const month = String(targetIso).slice(0, 7);
  const candidates = [...new Set(candidateDates)]
    .filter((candidate) => String(candidate).startsWith(`${month}-`))
    .map((candidate) => ({
      iso: candidate,
      time: Date.parse(`${candidate}T00:00:00Z`)
    }))
    .filter(({ time }) => Number.isFinite(time));

  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.time - targetTime);
    const rightDistance = Math.abs(right.time - targetTime);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    const leftIsLater = left.time > targetTime ? 1 : 0;
    const rightIsLater = right.time > targetTime ? 1 : 0;
    if (leftIsLater !== rightIsLater) return leftIsLater - rightIsLater;
    return left.time - right.time;
  });
  return candidates[0]?.iso ?? null;
}
