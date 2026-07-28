import path from "node:path";

export function parseCliArgs(argv) {
  const options = {
    browser: "chrome",
    date: localDate(),
    dryRun: false,
    help: false
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
    if (argument === "--statement" || argument === "--candidate" ||
        argument === "--amount" || argument === "--date" ||
        argument === "--browser" || argument === "--profile") {
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
  if (Boolean(options.statement) === Boolean(options.candidate)) {
    throw new Error("Choose exactly one of --statement or --candidate.");
  }
  if (options.statement && !options.amount) {
    throw new Error("--amount is required with --statement.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }
  if (!["chrome", "msedge"].includes(options.browser)) {
    throw new Error("--browser must be chrome or msedge.");
  }

  if (options.statement) options.statement = path.resolve(options.statement);
  if (options.candidate) options.candidate = path.resolve(options.candidate);
  if (options.profile) options.profile = path.resolve(options.profile);
  return options;
}

export function localDate(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}
