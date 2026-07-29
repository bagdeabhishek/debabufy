import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("the CLI shim can load the shared portal helper", () => {
  let listener = null;
  const sandbox = {
    __form141CliApi: {
      runtime: {
        onMessage: {
          addListener(candidate) {
            listener = candidate;
          }
        }
      }
    }
  };
  const source = fs.readFileSync(
    new URL("../browser/portal-helper.js", import.meta.url),
    "utf8"
  );
  vm.runInNewContext(source, sandbox);
  assert.equal(typeof listener, "function");
});
