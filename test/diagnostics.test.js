import assert from "node:assert/strict";
import test from "node:test";

test("diagnostic recorder keeps structure and redacts sensitive values", async () => {
  const syntheticPan = ["ABCDE", "1234", "F"].join("");
  let listener;
  const sessionStore = {};
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.0.0-test" }),
      onMessage: {
        addListener(callback) {
          listener = callback;
        }
      }
    },
    storage: {
      session: {
        async get(key) {
          return { [key]: sessionStore[key] };
        },
        async set(value) {
          Object.assign(sessionStore, value);
        },
        async remove(key) {
          delete sessionStore[key];
        }
      }
    }
  };

  await import(`../extension/background.js?test=${Date.now()}`);

  const send = (message, sender = {}) =>
    new Promise((resolve) => listener(message, sender, resolve));

  await send({ type: "FORM141_DIAGNOSTIC_START" });
  await send(
    {
      type: "FORM141_DIAGNOSTIC_EVENT",
      record: {
        kind: "api-response",
        endpoint: "https://eportal.incometax.gov.in/iec/paymentapi/example",
        status: 200,
        schema: ["payload.pan:string", "payload.amount:number"],
        requestBody: JSON.stringify({ pan: syntheticPan }),
        value: syntheticPan,
        message: `${syntheticPan} person@example.invalid CRN123456789 9876543210`
      }
    },
    {
      tab: {
        url: "https://eportal.incometax.gov.in/path?secret=must-not-appear"
      }
    }
  );
  const stopped = await send({ type: "FORM141_DIAGNOSTIC_STOP" });
  const serialized = JSON.stringify(stopped.report);

  assert.equal(stopped.report.records.length, 1);
  assert.equal(stopped.report.records[0].status, 200);
  assert.deepEqual(stopped.report.records[0].schema, [
    "payload.pan:string",
    "payload.amount:number"
  ]);
  assert.equal(stopped.report.records[0].requestBody, "[REDACTED]");
  assert.equal(stopped.report.records[0].value, "[REDACTED]");
  assert.equal(
    stopped.report.records[0].tabPath,
    "https://eportal.incometax.gov.in/path"
  );
  assert.doesNotMatch(
    serialized,
    new RegExp(
      `${syntheticPan}|person@example|CRN123456789|9876543210|must-not-appear`
    )
  );

  delete globalThis.chrome;
});
