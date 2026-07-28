(() => {
  if (globalThis.__form141DiagnosticBridgeLoaded) return;
  globalThis.__form141DiagnosticBridgeLoaded = true;

  const API_PATTERN = /\/iec\/paymentapi\//i;
  const SOURCE = "FORM141_DIAGNOSTIC_BRIDGE";
  const originalFetch = globalThis.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const xhrMetadata = new WeakMap();

  const emit = (record) => {
    globalThis.postMessage({ source: SOURCE, record }, location.origin);
  };

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    xhrMetadata.set(this, { method: String(method), url: String(url) });
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const metadata = xhrMetadata.get(this);
    if (metadata && API_PATTERN.test(metadata.url)) {
      emit({
        kind: "api-request",
        transport: "xhr",
        method: metadata.method,
        endpoint: safeEndpoint(metadata.url),
        schema: jsonSchema(body)
      });
      this.addEventListener("loadend", () => {
        let response = null;
        try {
          response = this.responseType === "json"
            ? this.response
            : this.responseText;
        } catch {
          // Response schema remains empty for inaccessible response types.
        }
        emit({
          kind: "api-response",
          transport: "xhr",
          endpoint: safeEndpoint(metadata.url),
          status: this.status,
          schema: jsonSchema(response)
        });
      }, { once: true });
    }
    return originalSend.call(this, body);
  };

  globalThis.fetch = async function(input, init) {
    const request = input instanceof Request ? input : new Request(input, init);
    if (API_PATTERN.test(request.url)) {
      request.clone().text().then((body) => emit({
        kind: "api-request",
        transport: "fetch",
        method: request.method,
        endpoint: safeEndpoint(request.url),
        schema: jsonSchema(body)
      }));
    }
    const response = await originalFetch.call(this, input, init);
    if (API_PATTERN.test(request.url)) {
      response.clone().text().then((body) => emit({
        kind: "api-response",
        transport: "fetch",
        endpoint: safeEndpoint(request.url),
        status: response.status,
        schema: jsonSchema(body)
      }));
    }
    return response;
  };

  globalThis.addEventListener("error", (event) => emit({
    kind: "page-error",
    errorType: event.error?.name ?? "Error",
    sourcePath: safeEndpoint(event.filename),
    line: event.lineno,
    column: event.colno
  }));

  globalThis.addEventListener("unhandledrejection", (event) => emit({
    kind: "unhandled-rejection",
    errorType: event.reason?.name ?? typeof event.reason
  }));

  setTimeout(() => emit({ kind: "bridge-ready" }), 0);

  function safeEndpoint(value) {
    try {
      const parsed = new URL(String(value), location.href);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return String(value ?? "").split("?")[0].slice(0, 500);
    }
  }

  function jsonSchema(input) {
    let value = input;
    if (typeof input === "string") {
      try {
        value = JSON.parse(input);
      } catch {
        return input ? ["<non-json:string>"] : [];
      }
    }
    const paths = [];
    walk(value, "", paths, new Set());
    return [...new Set(paths)].slice(0, 500);
  }

  function walk(value, path, output, seen) {
    if (value == null || typeof value !== "object") {
      if (path) output.push(`${path}:${value === null ? "null" : typeof value}`);
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      if (!value.length && path) output.push(`${path}[]:empty`);
      if (value.length) walk(value[0], `${path}[]`, output, seen);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, output, seen);
    }
  }

})();
