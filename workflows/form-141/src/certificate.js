const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const ACKNOWLEDGEMENT_PATTERN = /\b[A-Z]{3}[0-9]{7,}\b/g;

export function parseForm132CertificateText(text) {
  const normalized = String(text ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ");

  if (
    !/FORM\s+NO\.?\s*132/i.test(normalized) ||
    !/Summary of Transaction\(s\).*Form\s+No\.?\s*141/is.test(normalized)
  ) {
    throw new Error(
      "The supporting file is not a Form 132 certificate generated from Form 141."
    );
  }

  const pans = [...new Set(
    (normalized.toUpperCase().match(PAN_PATTERN) ?? [])
  )];
  const acknowledgements = [...new Set(
    (normalized.toUpperCase().match(ACKNOWLEDGEMENT_PATTERN) ?? [])
  )];
  const taxYear = normalized.match(/Tax\s+Year\s*[\t :\n-]*\s*(20\d{2}\s*[-/]\s*\d{2,4})/i);

  if (!pans[0]) {
    throw new Error("The Form 132 certificate does not contain the buyer PAN.");
  }
  if (!acknowledgements[0]) {
    throw new Error(
      "The Form 132 certificate does not contain its Form 141 acknowledgement number."
    );
  }

  return {
    buyerPan: pans[0],
    acknowledgementNumber: acknowledgements[0],
    taxYear: taxYear?.[1]?.replace(/[\s/]/g, "-") ?? null
  };
}
