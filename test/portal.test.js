import assert from "node:assert/strict";
import test from "node:test";
import {
  detailSectionIndex,
  expectedBuyerShare,
  filingWithPortalBuyerShare
} from "../src/lib/portal.js";

test("a single portal buyer is assigned the full 100 percent share", () => {
  const filing = {
    buyers: [{ pan: "SYNTHETIC", share_percentage: 50 }]
  };
  const portalFiling = filingWithPortalBuyerShare(filing);

  assert.equal(expectedBuyerShare(filing, 0), 100);
  assert.equal(portalFiling.buyers[0].share_percentage, 100);
  assert.equal(filing.buyers[0].share_percentage, 50);
});

test("multiple portal buyers retain their reviewed shares", () => {
  const filing = {
    buyers: [
      { pan: "SYNTHETIC1", share_percentage: 40 },
      { pan: "SYNTHETIC2", share_percentage: 60 }
    ]
  };

  assert.equal(expectedBuyerShare(filing, 0), 40);
  assert.equal(expectedBuyerShare(filing, 1), 60);
  assert.equal(filingWithPortalBuyerShare(filing), filing);
});

test("Form 141 detail buttons follow buyer, seller, transaction order", () => {
  assert.equal(detailSectionIndex("buyer"), 0);
  assert.equal(detailSectionIndex("seller"), 1);
  assert.equal(detailSectionIndex("transaction"), 2);
  assert.equal(detailSectionIndex("unknown"), null);
});
