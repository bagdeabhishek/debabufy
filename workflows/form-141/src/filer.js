function normalizedPan(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function selectFilingBuyer(filing, previous, {
  filingBuyerPan,
  certificate = null
} = {}) {
  const buyers = filing.buyers ?? [];
  const statementBuyerPan = normalizedPan(previous.meta?.taxpayer?.pan);
  const selectedPan = normalizedPan(
    filingBuyerPan || statementBuyerPan || buyers[0]?.pan
  );
  const selectedBuyer = buyers.find(
    (buyer) => normalizedPan(buyer.pan) === selectedPan
  );

  if (!selectedBuyer) {
    throw new Error("Choose a buyer listed in the previous Form 141 statement.");
  }

  let acknowledgementNumber = previous.meta?.acknowledgement_number ?? null;
  let acknowledgementSource = "previous Form 141 statement";
  const isDifferentBuyer = Boolean(statementBuyerPan) && selectedPan !== statementBuyerPan;

  if (isDifferentBuyer) {
    if (!certificate) {
      throw new Error(
        "Choose the selected buyer's Form 132 certificate so DeBabufy can verify their previous acknowledgement number."
      );
    }
    if (normalizedPan(certificate.buyerPan) !== selectedPan) {
      throw new Error(
        "The Form 132 certificate belongs to a different buyer than the selected filing buyer."
      );
    }
    if (
      certificate.taxYear && previous.meta?.tax_year &&
      certificate.taxYear !== previous.meta.tax_year
    ) {
      throw new Error(
        "The Form 132 certificate and previous Form 141 statement have different tax years."
      );
    }
    acknowledgementNumber = certificate.acknowledgementNumber;
    acknowledgementSource = "selected buyer's Form 132 certificate";
  }

  if (!acknowledgementNumber) {
    throw new Error("The previous Form 141 acknowledgement number could not be determined.");
  }

  filing.meta ??= {};
  filing.meta.filing_buyer_pan = selectedPan;
  filing.meta.filing_buyer_name = selectedBuyer.name ?? null;
  filing.meta.previous_acknowledgement_number = acknowledgementNumber;
  filing.review ??= { approved: false, warnings: [], decisions: [] };
  filing.review.decisions ??= [];
  filing.review.decisions.push({
    path: "meta.previous_acknowledgement_number",
    previous: previous.meta?.acknowledgement_number ?? null,
    proposed: acknowledgementNumber,
    source: acknowledgementSource,
    confidence: "high",
    requires_review: true
  });
  return filing;
}
