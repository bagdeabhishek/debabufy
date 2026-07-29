import path from "node:path";

export function parseCliArgs(argv) {
  const options = {
    cdp: "http://127.0.0.1:9222",
    date: localDate(),
    dryRun: false,
    help: false,
    probe: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--probe") {
      options.probe = true;
      continue;
    }
    if (argument === "--statement" || argument === "--candidate" ||
        argument === "--amount" || argument === "--date" ||
        argument === "--cdp") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (options.help) return options;
  if (!options.probe && Boolean(options.statement) === Boolean(options.candidate)) {
    throw new Error("Choose exactly one of --statement or --candidate.");
  }
  if (options.probe && (options.statement || options.candidate || options.dryRun)) {
    throw new Error("--probe cannot be combined with filing input or --dry-run.");
  }
  if (!options.probe && options.statement && !options.amount) {
    throw new Error("--amount is required with --statement.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }
  try {
    const cdp = new URL(options.cdp);
    if (
      !["http:", "https:", "ws:", "wss:"].includes(cdp.protocol) ||
      !["127.0.0.1", "localhost", "::1"].includes(cdp.hostname)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("--cdp must be a loopback Chrome DevTools URL.");
  }

  if (options.statement) options.statement = path.resolve(options.statement);
  if (options.candidate) options.candidate = path.resolve(options.candidate);
  return options;
}

export function localDate(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}
