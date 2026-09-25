import assert from "node:assert/strict";
import test from "node:test";
import {
  nearestDateInSameMonth,
  parseCalendarDateLabel
} from "../src/calendar.js";

test("parses common Angular Material calendar labels", () => {
  assert.equal(parseCalendarDateLabel("5 August 2026"), "2026-08-05");
  assert.equal(parseCalendarDateLabel("August 5, 2026"), "2026-08-05");
  assert.equal(parseCalendarDateLabel("2026-08-05"), "2026-08-05");
});

test("chooses the nearest enabled date and prefers the earlier date on a tie", () => {
  assert.equal(
    nearestDateInSameMonth("2026-08-05", [
      "2026-08-03",
      "2026-08-04",
      "2026-08-06",
      "2026-08-09"
    ]),
    "2026-08-04"
  );
});

test("does not substitute a date from another month", () => {
  assert.equal(
    nearestDateInSameMonth("2026-08-01", ["2026-07-31", "2026-09-01"]),
    null
  );
});
