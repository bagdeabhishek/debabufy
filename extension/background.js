const api = globalThis.browser ?? globalThis.chrome;
const STORAGE_KEY = "form141DiagnosticSession";
const MAX_RECORDS = 2000;
const MAX_TEXT = 500;

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!String(message?.type ?? "").startsWith("FORM141_DIAGNOSTIC_")) {
    return undefined;
  }
  handle(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({
      ok: false,
      error: error.message || String(error)
    }));
  return true;
});

async function handle(message, sender) {
  if (message.type === "FORM141_DIAGNOSTIC_START") {
    const session = {
      format: "form141-redacted-diagnostics-v1",
      active: true,
      startedAt: new Date().toISOString(),
      endedAt: null,
      extensionVersion: api.runtime.getManifest().version,
      records: []
    };
    await api.storage.session.set({ [STORAGE_KEY]: session });
    return { ok: true, active: true, records: 0 };
  }

  if (message.type === "FORM141_DIAGNOSTIC_EVENT") {
    const stored = await readSession();
    if (!stored?.active) return { ok: true, recorded: false };
    const record = sanitizeRecord({
      ...message.record,
      capturedAt: new Date().toISOString(),
      tabPath: safePath(sender.tab?.url)
    });
    stored.records.push(record);
    if (stored.records.length > MAX_RECORDS) {
      stored.records.splice(0, stored.records.length - MAX_RECORDS);
      stored.truncated = true;
    }
    await api.storage.session.set({ [STORAGE_KEY]: stored });
    return { ok: true, recorded: true, records: stored.records.length };
  }

  if (message.type === "FORM141_DIAGNOSTIC_STATUS") {
    const stored = await readSession();
    return {
      ok: true,
      active: Boolean(stored?.active),
      records: stored?.records?.length ?? 0,
      startedAt: stored?.startedAt ?? null
    };
  }

  if (message.type === "FORM141_DIAGNOSTIC_STOP") {
    const stored = await readSession();
    if (!stored) return { ok: true, report: emptyReport() };
    stored.active = false;
    stored.endedAt = new Date().toISOString();
    await api.storage.session.set({ [STORAGE_KEY]: stored });
    return { ok: true, report: stored };
  }

  if (message.type === "FORM141_DIAGNOSTIC_GET") {
    return { ok: true, report: (await readSession()) ?? emptyReport() };
  }

  if (message.type === "FORM141_DIAGNOSTIC_CLEAR") {
    await api.storage.session.remove(STORAGE_KEY);
    return { ok: true, active: false, records: 0 };
  }

  return { ok: false, error: "Unknown diagnostic action." };
}

async function readSession() {
  return (await api.storage.session.get(STORAGE_KEY))?.[STORAGE_KEY] ?? null;
}

function emptyReport() {
  return {
    format: "form141-redacted-diagnostics-v1",
    active: false,
    startedAt: null,
    endedAt: null,
    extensionVersion: api.runtime.getManifest().version,
    records: []
  };
}

function sanitizeRecord(record) {
  return sanitizeValue(record, "");
}

function sanitizeValue(value, key) {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    if (/value|body|header|cookie|token|authorization/i.test(key)) {
      return "[REDACTED]";
    }
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 300).map((item) => sanitizeValue(item, key));
  }
  if (typeof value === "object") {
    const sanitized = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (/raw|requestBody|responseBody|headers|cookies|candidate|filing/i.test(childKey)) {
        sanitized[childKey] = "[REDACTED]";
      } else {
        sanitized[childKey] = sanitizeValue(childValue, childKey);
      }
    }
    return sanitized;
  }
  return redactText(String(value));
}

function redactText(value) {
  return String(value)
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[PAN]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b(?:CLN|CRN)[A-Z0-9-]{5,}\b/gi, "[REFERENCE]")
    .replace(/\b\d{10,}\b/g, "[NUMBER]")
    .slice(0, MAX_TEXT);
}

function safePath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}
