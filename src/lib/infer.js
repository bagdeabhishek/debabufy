const MONEY_FIELDS = new Set([
  "property.consideration_value",
  "property.stamp_duty_value",
  "transaction.current_payment_amount",
  "transaction.cumulative_previous_installments",
  "tax_deposit.tds_amount",
  "tax_deposit.interest",
  "tax_deposit.other_fee",
  "tax_deposit.total_amount"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundRupees(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function asFiniteNumber(value, label) {
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return parsed;
}

function getAtPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setAtPath(object, path, value) {
  const parts = path.split(".");
  let current = object;
  for (const part of parts.slice(0, -1)) {
    current[part] ??= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function flatten(object, prefix = "", result = {}) {
  if (Array.isArray(object)) {
    object.forEach((value, index) => flatten(value, `${prefix}[${index}]`, result));
    return result;
  }
  if (object && typeof object === "object") {
    for (const [key, value] of Object.entries(object)) {
      if (key === "extraction" || key === "review") continue;
      flatten(value, prefix ? `${prefix}.${key}` : key, result);
    }
    return result;
  }
  result[prefix] = object;
  return result;
}

function derivePreviousCumulative(previous) {
  const cumulative = Number(previous.transaction?.cumulative_previous_installments);
  const lastPaid = Number(previous.transaction?.current_payment_amount);
  if (Number.isFinite(cumulative) && Number.isFinite(lastPaid)) {
    return roundRupees(cumulative + lastPaid);
  }
  if (Number.isFinite(lastPaid)) return roundRupees(lastPaid);
  return null;
}

function deriveRate(previous) {
  const explicit = Number(previous.tax_deposit?.rate_percent);
  if (Number.isFinite(explicit) && explicit > 0) {
    return { value: explicit, source: "previous statement rate", confidence: "medium" };
  }
  const oldAmount = Number(previous.transaction?.current_payment_amount);
  const oldTds = Number(previous.tax_deposit?.tds_amount);
  if (Number.isFinite(oldAmount) && oldAmount > 0 && Number.isFinite(oldTds) && oldTds >= 0) {
    return {
      value: roundRupees((oldTds / oldAmount) * 100),
      source: "derived from previous TDS ÷ previous payment",
      confidence: "low"
    };
  }
  return { value: null, source: "not available", confidence: "low" };
}

function addDecision(decisions, path, previousValue, proposedValue, source, confidence, requiresReview = true) {
  decisions.push({
    path,
    previous: previousValue ?? null,
    proposed: proposedValue ?? null,
    source,
    confidence,
    requires_review: requiresReview
  });
}

export function inferNextFiling(previousInput, options) {
  const previous = clone(previousInput);
  const amount = asFiniteNumber(options.amount, "Current payment amount");
  const paymentDate = String(options.paymentDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    throw new Error("Payment date must use YYYY-MM-DD.");
  }

  const candidate = clone(previous);
  candidate.meta = {
    ...candidate.meta,
    form: "26QB",
    previous_acknowledgement_number: previous.meta?.acknowledgement_number ?? null,
    acknowledgement_number: null,
    source_format: "inferred-next-filing"
  };
  candidate.portal = {
    tds26_type: "SCHEDULE_B",
    tile_id: 21,
    ...(candidate.portal ?? {})
  };
  delete candidate.extraction;

  const decisions = [];
  const previousFlat = flatten(previous);
  const candidateFlat = flatten(candidate);

  for (const [path, value] of Object.entries(candidateFlat)) {
    if (
      path.startsWith("buyers[") ||
      path.startsWith("sellers[") ||
      path.startsWith("property.") ||
      path === "meta.tax_year"
    ) {
      addDecision(decisions, path, previousFlat[path], value, "carried from previous statement", "medium");
    }
  }

  const rate = deriveRate(previous);
  const proposedTds = rate.value == null ? null : roundRupees((amount * rate.value) / 100);
  const previousCumulative = derivePreviousCumulative(previous);

  const overrides = {
    "transaction.current_payment_amount": amount,
    "transaction.tax_liable_amount": amount,
    "transaction.payment_date": paymentDate,
    "transaction.deduction_date": paymentDate,
    "transaction.cumulative_previous_installments": previousCumulative,
    "tax_deposit.rate_percent": rate.value,
    "tax_deposit.tds_amount": proposedTds,
    "tax_deposit.interest": 0,
    "tax_deposit.other_fee": 0,
    "tax_deposit.total_amount": proposedTds
  };

  for (const [path, proposed] of Object.entries(overrides)) {
    const source = path === "transaction.current_payment_amount"
      ? "user supplied"
      : path === "transaction.tax_liable_amount"
        ? "proposed equal to current payment amount"
      : path.includes("payment_date") || path.includes("deduction_date")
        ? "selected payment date"
        : path === "transaction.cumulative_previous_installments"
          ? "previous cumulative amount + previous current payment"
          : path === "tax_deposit.rate_percent"
            ? rate.source
            : path === "tax_deposit.tds_amount"
              ? "current payment × proposed prior rate"
              : path === "tax_deposit.total_amount"
                ? "proposed TDS + zero proposed interest/fee"
                : "reset for new payment; must be confirmed";
    const confidence = path === "transaction.current_payment_amount"
      ? "high"
      : path.includes("payment_date") || path.includes("deduction_date")
        ? "medium"
        : path === "tax_deposit.rate_percent"
          ? rate.confidence
          : "low";
    addDecision(decisions, path, getAtPath(previous, path), proposed, source, confidence);
    setAtPath(candidate, path, proposed);
  }

  const warnings = [
    "The tool does not determine tax treatment. Confirm the rate, TDS, interest, fee, and total against the portal or a tax professional.",
    "Payment and deduction dates are proposed from the selected date and require review.",
    "No challan or payment will be created by the inference step."
  ];
  if (!previous.meta?.acknowledgement_number) {
    warnings.push("The previous acknowledgement number is missing and must be entered before filing.");
  }
  if (rate.value == null) {
    warnings.push("No prior deduction rate could be found or derived; TDS remains blank.");
  }
  if (!candidate.buyers?.length || !candidate.sellers?.length) {
    warnings.push("Buyer or seller records are missing.");
  }
  const buyerShare = (candidate.buyers ?? []).reduce(
    (total, buyer) => total + (Number(buyer.share_percentage) || 0),
    0
  );
  const sellerShare = (candidate.sellers ?? []).reduce(
    (total, seller) => total + (Number(seller.share_percentage) || 0),
    0
  );
  if (candidate.buyers?.length && Math.abs(buyerShare - 100) > 0.01) {
    warnings.push(`Buyer shares total ${buyerShare}%, not 100%.`);
  }
  if (candidate.sellers?.length && Math.abs(sellerShare - 100) > 0.01) {
    warnings.push(`Seller shares total ${sellerShare}%, not 100%.`);
  }
  const consideration = Number(candidate.property?.consideration_value);
  if (
    Number.isFinite(consideration) &&
    Number.isFinite(previousCumulative) &&
    previousCumulative + amount > consideration
  ) {
    warnings.push("Previous instalments plus this payment exceed the carried consideration value.");
  }
  if (/last/i.test(previous.portal?.installment_sequence ?? "")) {
    warnings.push("The previous statement is marked as a last instalment; do not create another filing without resolving this.");
  }
  if (candidate.meta?.tax_year && !String(candidate.meta.tax_year).includes(paymentDate.slice(0, 4))) {
    warnings.push("The carried tax year may not match the selected payment date; confirm it manually.");
  }

  candidate.review = {
    approved: false,
    approved_at: null,
    decisions,
    warnings
  };
  return candidate;
}

export function validateReviewedFiling(filing) {
  const errors = [];
  if (!filing || typeof filing !== "object") return ["Filing data is missing."];
  if (filing.meta?.form !== "26QB") errors.push("Only Form 26QB is supported.");
  if (!filing.buyers?.length) errors.push("At least one buyer is required.");
  if (!filing.sellers?.length) errors.push("At least one seller is required.");
  if (!(Number(filing.transaction?.current_payment_amount) > 0)) {
    errors.push("Current payment amount must be positive.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filing.transaction?.payment_date ?? "")) {
    errors.push("Payment date must use YYYY-MM-DD.");
  }
  if (filing.tax_deposit?.tds_amount == null) errors.push("TDS amount requires review.");
  if (filing.tax_deposit?.interest == null) errors.push("Interest requires review.");
  if (filing.tax_deposit?.other_fee == null) errors.push("Other fee requires review.");
  if (!filing.review?.approved) errors.push("Review must be explicitly approved.");

  for (const [path, value] of Object.entries(flatten(filing))) {
    if (MONEY_FIELDS.has(path) && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      errors.push(`${path} must be a non-negative number.`);
    }
  }
  return errors;
}

export const inferenceInternals = {
  deriveRate,
  derivePreviousCumulative,
  flatten,
  roundRupees
};
