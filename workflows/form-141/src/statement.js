const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;

const LABELS = {
  acknowledgement_number: [
    "acknowledgement number",
    "acknowledgment number",
    "ack no",
    "acknowledgement no",
    "acknowledgment no",
    "previous acknowledgement number"
  ],
  tax_year: ["assessment year", "financial year", "tax year"],
  buyer_pan: ["pan of buyer", "pan of transferee", "buyer pan"],
  buyer_name: ["name of buyer", "name of transferee", "buyer name"],
  seller_pan: ["pan of seller", "pan of transferor", "seller pan"],
  seller_name: ["name of seller", "name of transferor", "seller name"],
  property_address: [
    "address of property transferred",
    "property address",
    "address of immovable property"
  ],
  agreement_date: ["date of agreement", "date of booking", "agreement/booking date"],
  consideration_value: [
    "total value of consideration",
    "value of consideration",
    "total consideration"
  ],
  stamp_duty_value: ["stamp duty value"],
  current_payment_amount: [
    "amount paid/credited",
    "amount paid or credited",
    "amount paid currently",
    "payment of installment"
  ],
  payment_date: [
    "date of payment/credit",
    "date of payment or credit",
    "payment date"
  ],
  deduction_date: ["date of tax deduction", "date of deduction"],
  rate: ["rate at which deducted", "rate of deduction", "tds rate"],
  tds_amount: [
    "amount of tax deducted at source",
    "tax deducted at source",
    "tds amount"
  ],
  interest: ["interest"],
  other_fee: ["fee", "other fee", "late filing fee"],
  total_amount: ["total amount", "total payment"]
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanValue(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/^[\s:–—-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function findLabelValue(text, aliases) {
  for (const alias of aliases) {
    const escaped = escapeRegExp(alias);
    const linePattern = new RegExp(
      `(?:^|\\n)\\s*${escaped}\\s*(?:\\n|[:–—-])\\s*([^\\n]{1,180})`,
      "i"
    );
    const match = text.match(linePattern);
    if (match) return cleanValue(match[1]);
  }
  return null;
}

function parseMoney(value) {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/[₹,\s]/g, "")
    .replace(/\b(?:INR|Rs\.?)\b/gi, "")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRate(value) {
  if (value == null) return null;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = cleanValue(value);
  const iso = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const indian = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (indian) {
    return `${indian[3]}-${indian[2].padStart(2, "0")}-${indian[1].padStart(2, "0")}`;
  }
  const namedMonth = raw.match(/\b(\d{1,2})-([A-Za-z]{3})-(20\d{2})\b/);
  if (namedMonth) {
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = months[namedMonth[2].toLowerCase()];
    if (month) return `${namedMonth[3]}-${month}-${namedMonth[1].padStart(2, "0")}`;
  }
  return raw;
}

function normalizeTaxYear(value) {
  if (!value) return null;
  const match = String(value).match(/\b(20\d{2})(?:\s*[-–/]\s*(\d{2,4}))?\b/);
  return match ? match[0].replace(/[–/]/g, "-").replace(/\s/g, "") : cleanValue(value);
}

function emptyNormalized() {
  return {
    meta: {
      form: "141-SCHEDULE-B",
      acknowledgement_number: null,
      tax_year: null,
      source_format: null
    },
    buyers: [],
    sellers: [],
    property: {
      address_text: null,
      agreement_date: null,
      consideration_value: null,
      stamp_duty_value: null
    },
    transaction: {
      current_payment_amount: null,
      payment_date: null,
      deduction_date: null,
      cumulative_previous_installments: null
    },
    tax_deposit: {
      rate_percent: null,
      tds_amount: null,
      interest: null,
      other_fee: null,
      total_amount: null
    },
    portal: {
      tds26_type: "SCHEDULE_B",
      tile_id: 21
    },
    extraction: {
      warnings: [],
      detected_fields: []
    }
  };
}

function record(normalized, field, value) {
  if (value !== null && value !== undefined && value !== "") {
    normalized.extraction.detected_fields.push(field);
  }
  return value;
}

export function parseStatementText(text) {
  const rawText = String(text ?? "").replace(/\r/g, "");
  const normalizedText = rawText
    .replace(/[ \t]+/g, " ");
  const result = emptyNormalized();
  result.meta.source_format = "text";

  if (
    /FORM NO\.\s*132/i.test(normalizedText) &&
    /Summary of Transaction\(s\).*Form No\.\s*141/i.test(normalizedText)
  ) {
    throw new Error(
      "This is a Form 132 TDS certificate, not the prior Form 141 challan statement. Choose the previous Form 141 Schedule B challan statement PDF."
    );
  }

  if (
    /Details of all buyers/i.test(normalizedText) &&
    /Summary of Transactions and Details of Tax/i.test(normalizedText)
  ) {
    return parseChallanStatementText(rawText);
  }

  const value = (field) => findLabelValue(normalizedText, LABELS[field]);

  result.meta.acknowledgement_number = record(
    result,
    "meta.acknowledgement_number",
    value("acknowledgement_number")
  );
  result.meta.tax_year = record(
    result,
    "meta.tax_year",
    normalizeTaxYear(value("tax_year"))
  );

  let buyerPan = value("buyer_pan");
  let sellerPan = value("seller_pan");
  const detectedPans = [...new Set((normalizedText.match(PAN_PATTERN) ?? []).map((pan) => pan.toUpperCase()))];
  if (!buyerPan && detectedPans[0]) buyerPan = detectedPans[0];
  if (!sellerPan && detectedPans[1]) sellerPan = detectedPans[1];

  const buyer = {
    pan: record(result, "buyers[0].pan", buyerPan?.toUpperCase() ?? null),
    name: record(result, "buyers[0].name", value("buyer_name")),
    pan_category: null,
    residential_status: null,
    share_percentage: null,
    email: null,
    mobile: null,
    address: null
  };
  const seller = {
    pan: record(result, "sellers[0].pan", sellerPan?.toUpperCase() ?? null),
    name: record(result, "sellers[0].name", value("seller_name")),
    pan_category: null,
    share_percentage: null,
    email: null,
    mobile: null
  };
  if (Object.values(buyer).some(Boolean)) result.buyers.push(buyer);
  if (Object.values(seller).some(Boolean)) result.sellers.push(seller);

  result.property.address_text = record(
    result,
    "property.address_text",
    value("property_address")
  );
  result.property.agreement_date = record(
    result,
    "property.agreement_date",
    normalizeDate(value("agreement_date"))
  );
  result.property.consideration_value = record(
    result,
    "property.consideration_value",
    parseMoney(value("consideration_value"))
  );
  result.property.stamp_duty_value = record(
    result,
    "property.stamp_duty_value",
    parseMoney(value("stamp_duty_value"))
  );
  result.transaction.current_payment_amount = record(
    result,
    "transaction.current_payment_amount",
    parseMoney(value("current_payment_amount"))
  );
  result.transaction.payment_date = record(
    result,
    "transaction.payment_date",
    normalizeDate(value("payment_date"))
  );
  result.transaction.deduction_date = record(
    result,
    "transaction.deduction_date",
    normalizeDate(value("deduction_date"))
  );
  result.tax_deposit.rate_percent = record(
    result,
    "tax_deposit.rate_percent",
    parseRate(value("rate"))
  );
  result.tax_deposit.tds_amount = record(
    result,
    "tax_deposit.tds_amount",
    parseMoney(value("tds_amount"))
  );
  result.tax_deposit.interest = record(
    result,
    "tax_deposit.interest",
    parseMoney(value("interest"))
  );
  result.tax_deposit.other_fee = record(
    result,
    "tax_deposit.other_fee",
    parseMoney(value("other_fee"))
  );
  result.tax_deposit.total_amount = record(
    result,
    "tax_deposit.total_amount",
    parseMoney(value("total_amount"))
  );

  if (!result.meta.acknowledgement_number) {
    result.extraction.warnings.push("Acknowledgement number was not detected.");
  }
  if (!result.buyers.length || !result.sellers.length) {
    result.extraction.warnings.push("Buyer or seller details were incomplete; review the extracted JSON.");
  }
  if (detectedPans.length > 2) {
    result.extraction.warnings.push(
      `Detected ${detectedPans.length} PAN-like values; party ordering requires review.`
    );
  }
  return result;
}

function splitRows(text) {
  return text.split("\n").map((line) =>
    line.split("\t").map(cleanValue).filter(Boolean)
  );
}

function rowText(row) {
  return row.join(" ");
}

function findRow(rows, pattern, start = 0) {
  for (let index = start; index < rows.length; index += 1) {
    if (pattern.test(rowText(rows[index]))) return index;
  }
  return -1;
}

function findDataRow(rows, start, predicate, end = rows.length) {
  for (let index = start; index < Math.min(end, rows.length); index += 1) {
    if (predicate(rows[index])) return { index, row: rows[index] };
  }
  return { index: -1, row: [] };
}

function isPan(value) {
  return /^[A-Z]{5}\d{4}[A-Z]$/i.test(cleanValue(value));
}

function parsePropertyAddress(addressText) {
  const parts = String(addressText ?? "")
    .split(",")
    .map(cleanValue)
    .filter(Boolean);
  if (!parts.length) return null;

  const pincodeIndex = parts.findLastIndex((part) => /^\d{6}$/.test(part));
  const pincode = pincodeIndex >= 0 ? parts[pincodeIndex] : null;
  const beforePin = pincodeIndex >= 0 ? parts.slice(0, pincodeIndex) : [...parts];
  const countryIndex = beforePin.findLastIndex((part) =>
    /^(?:india|bharat)$/i.test(part)
  );
  const country = countryIndex >= 0 ? beforePin[countryIndex] : null;
  const geographic = countryIndex >= 0
    ? beforePin.slice(0, countryIndex)
    : beforePin;
  const state = geographic.pop() ?? null;
  const district = geographic.pop() ?? null;
  const postOfficeIndex = geographic.findLastIndex((part) =>
    /\b(?:B\.?O\.?|H\.?O\.?|S\.?O\.?)$/i.test(part)
  );
  const postOffice = postOfficeIndex >= 0
    ? geographic.splice(postOfficeIndex, 1)[0]
    : null;
  const area = geographic.pop() ?? null;
  while (
    geographic.length &&
    compactAddressPart(geographic.at(-1)) === compactAddressPart(area)
  ) {
    geographic.pop();
  }
  const flatParts = geographic.splice(0, Math.min(2, geographic.length));

  return {
    flat_or_building: flatParts.join(", ") || null,
    street: geographic.join(", ") || null,
    area,
    state,
    district,
    post_office: postOffice,
    pincode,
    country
  };
}

function compactAddressPart(value) {
  return cleanValue(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parsePercent(value) {
  return parseRate(value);
}

function parseChallanStatementText(text) {
  const rows = splitRows(text);
  const result = emptyNormalized();
  result.meta.source_format = "challan-statement-pdf";

  const labelled = (pattern) => {
    const index = findRow(rows, pattern);
    return index >= 0 ? rows[index][1] ?? null : null;
  };
  result.meta.acknowledgement_number = labelled(/^Acknowledg(?:e)?ment Number/i);
  result.meta.challan_identification_number = labelled(/^Challan Identification Number/i);
  result.meta.e_filing_date = normalizeDate(labelled(/^Date of E-Filing/i));

  const taxpayerHeader = findRow(rows, /^PAN Name /i);
  if (taxpayerHeader >= 0 && rows[taxpayerHeader + 1]?.length >= 2) {
    result.meta.taxpayer = {
      pan: rows[taxpayerHeader + 1][0] ?? null,
      name: rows[taxpayerHeader + 1][1] ?? null,
      related_person_name: rows[taxpayerHeader + 1][2] ?? null
    };
  }
  const contactHeader = findRow(rows, /^Address (?:Mobile|Contact) Number Email/i);
  if (contactHeader >= 0 && rows[contactHeader + 1]?.length >= 3) {
    result.meta.taxpayer ??= {};
    result.meta.taxpayer.address = rows[contactHeader + 1][0] ?? null;
    result.meta.taxpayer.mobile = rows[contactHeader + 1][1] ?? null;
    result.meta.taxpayer.email = rows[contactHeader + 1][2] ?? null;
  }

  const paymentHeader = findRow(rows, /Tax year of transaction.*Month of Deduction/i);
  if (paymentHeader >= 0) {
    const payment = findDataRow(
      rows,
      paymentHeader + 1,
      (row) => row.length >= 4 && /\d/.test(row[0]),
      paymentHeader + 5
    ).row;
    result.meta.tax_year = normalizeTaxYear(payment[0]);
    result.portal.previous_month_of_deduction = payment[1] ?? null;
    result.portal.major_head = payment[2] ?? null;
    result.portal.minor_head = payment[3] ?? null;
  }
  const statusHeader = findRow(rows, /Residential Status.*Payment Mode.*Bank Name/i);
  if (statusHeader >= 0) {
    const status = rows[statusHeader + 1] ?? [];
    result.portal.residential_status = status[0] ?? null;
    result.portal.property_type_label = status[1] ?? null;
    result.portal.previous_payment_mode = status[2] ?? null;
    result.portal.previous_bank_name = status[3] ?? null;
  }

  const propertyHeader = findRow(rows, /^Type of immovable property.*Address of property/i);
  const saleHeader = findRow(rows, /^Total sale consideration/i, Math.max(0, propertyHeader));
  if (propertyHeader >= 0 && saleHeader > propertyHeader) {
    const propertyData = findDataRow(
      rows,
      propertyHeader + 1,
      (row) => row.length >= 3 && !/transferred$/i.test(rowText(row)),
      saleHeader
    );
    const propertyRow = propertyData.row;
    result.property.property_type = propertyRow[0] ?? null;
    result.property.agreement_date = normalizeDate(propertyRow.at(-2));
    result.property.stamp_duty_value = parseMoney(propertyRow.at(-1));
    result.property.address_text = rows
      .slice(propertyData.index + 1, saleHeader)
      .flat()
      .join(" ")
      .trim() || null;
    result.property.raw_address = parsePropertyAddress(
      result.property.address_text
    );

    const saleData = findDataRow(
      rows,
      saleHeader + 1,
      (row) => row.length >= 4 && parseMoney(row[0]) != null,
      saleHeader + 5
    ).row;
    result.property.consideration_value = parseMoney(saleData[0]);
    result.portal.installment_payment_type = saleData[1] ?? null;
    result.portal.installment_sequence = saleData[2] ?? null;
    result.meta.previous_acknowledgement_number = saleData[3] ?? null;
  }

  const buyersStart = findRow(rows, /^Details of all buyers$/i);
  const sellersStart = findRow(rows, /^Details of all deductees/i);
  if (buyersStart >= 0 && sellersStart > buyersStart) {
    for (const row of rows.slice(buyersStart + 1, sellersStart)) {
      if (row.length >= 4 && isPan(row[1])) {
        result.buyers.push({
          pan: row[1].toUpperCase(),
          name: row[2] ?? null,
          share_percentage: parsePercent(row[3]),
          pan_category: null,
          residential_status: result.portal.residential_status,
          email: null,
          mobile: null,
          address: null
        });
      }
    }
    const taxpayerPan = result.meta.taxpayer?.pan?.toUpperCase();
    const taxpayerBuyer = result.buyers.find((buyer) => buyer.pan === taxpayerPan);
    if (taxpayerBuyer) {
      taxpayerBuyer.email = result.meta.taxpayer.email ?? taxpayerBuyer.email;
      taxpayerBuyer.mobile = result.meta.taxpayer.mobile ?? taxpayerBuyer.mobile;
      taxpayerBuyer.address = result.meta.taxpayer.address ?? taxpayerBuyer.address;
    }
  }

  const transactionSections = rows
    .map((row, index) => (/^Transaction Details$/i.test(rowText(row)) ? index : -1))
    .filter((index) => index >= 0);
  const secondTransaction = transactionSections[1] ?? rows.length;
  if (sellersStart >= 0) {
    for (const row of rows.slice(sellersStart + 1, secondTransaction)) {
      if (row.length >= 6 && isPan(row[1])) {
        result.sellers.push({
          pan: row[1].toUpperCase(),
          name: row[2] ?? null,
          mobile: row[3] ?? null,
          email: row[4] ?? null,
          share_percentage: parsePercent(row[5]),
          pan_category: null
        });
      }
    }
  }

  if (secondTransaction < rows.length) {
    const transfer = findDataRow(
      rows,
      secondTransaction + 1,
      (row) => row.length >= 12 && isPan(row[1]),
      secondTransaction + 12
    ).row;
    const hasCertificate = transfer.length >= 13;
    result.transaction.deductee_pan = transfer[1] ?? null;
    result.transaction.deductee_name = transfer[2] ?? null;
    result.property.proportionate_stamp_duty_value = parseMoney(transfer[3]);
    result.transaction.cumulative_previous_installments = parseMoney(transfer[4]);
    result.transaction.current_payment_amount = parseMoney(transfer[5]);
    result.transaction.tax_liable_amount = parseMoney(transfer[6]);
    result.transaction.payment_date = normalizeDate(transfer[7]);
    result.transaction.section_395_applicable = transfer[8] ?? null;
    result.transaction.section_395_certificate = hasCertificate ? transfer[9] : null;
    result.tax_deposit.rate_percent = parseRate(transfer[hasCertificate ? 10 : 9]);
    result.tax_deposit.tds_amount = parseMoney(transfer[hasCertificate ? 11 : 10]);
    result.transaction.deduction_date = normalizeDate(transfer[hasCertificate ? 12 : 11]);
  }

  const summaryStart = findRow(rows, /Summary of Transactions and Details of Tax/i);
  if (summaryStart >= 0) {
    const summary = findDataRow(
      rows,
      summaryStart + 1,
      (row) => row.length >= 10 && parseMoney(row[4]) != null,
      summaryStart + 12
    ).row;
    result.tax_deposit.tds_amount = parseMoney(summary[4]) ?? result.tax_deposit.tds_amount;
    result.tax_deposit.interest = parseMoney(summary[5]);
    result.tax_deposit.other_fee = parseMoney(summary[6]);
    result.tax_deposit.total_amount = parseMoney(summary[7]);
    result.portal.previous_payment_mode = summary[8] ?? result.portal.previous_payment_mode;
    result.meta.challan_identification_number =
      summary[9] ?? result.meta.challan_identification_number;
  }

  const required = [
    ["acknowledgement number", result.meta.acknowledgement_number],
    ["buyer details", result.buyers.length],
    ["seller details", result.sellers.length],
    ["property consideration", result.property.consideration_value],
    ["previous installment amount", result.transaction.current_payment_amount],
    ["deduction rate", result.tax_deposit.rate_percent]
  ];
  for (const [label, found] of required) {
    if (found == null || found === 0 || found === "") {
      result.extraction.warnings.push(`Could not extract ${label}; manual review is required.`);
    }
  }
  result.extraction.detected_fields = Object.entries({
    acknowledgement_number: result.meta.acknowledgement_number,
    tax_year: result.meta.tax_year,
    buyers: result.buyers.length,
    sellers: result.sellers.length,
    property_address: result.property.address_text,
    consideration_value: result.property.consideration_value,
    stamp_duty_value: result.property.stamp_duty_value,
    previous_payment: result.transaction.current_payment_amount,
    previous_installments: result.transaction.cumulative_previous_installments,
    rate: result.tax_deposit.rate_percent,
    tds_amount: result.tax_deposit.tds_amount
  }).filter(([, found]) => found != null && found !== "" && found !== 0).map(([field]) => field);
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeStatementJson(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Statement JSON must be an object.");
  }
  if (input.meta && input.property && input.transaction && input.tax_deposit) {
    const normalized = clone(input);
    normalized.meta = {
      form: "141-SCHEDULE-B",
      ...normalized.meta,
      source_format: "json"
    };
    normalized.portal = { tds26_type: "SCHEDULE_B", tile_id: 21, ...normalized.portal };
    normalized.extraction ??= { warnings: [], detected_fields: [] };
    return normalized;
  }

  // Accept the Income Tax portal's Schedule B-shaped JSON when available.
  const schedule = input.scheduleB ?? input;
  if (schedule.buyerDetails || schedule.buyerDetls || schedule.sellerDetails) {
    const result = emptyNormalized();
    result.meta.source_format = "portal-json";
    result.meta.acknowledgement_number = schedule.prevAckNum ?? null;
    result.meta.tax_year = input.taxYear ?? schedule.taxYear ?? null;
    result.buyers = clone(schedule.buyerDetails ?? (schedule.buyerDetls ? [schedule.buyerDetls] : []));
    result.sellers = clone(schedule.sellerDetails ?? []);
    result.property = {
      address_text: [
        schedule.flatAddress,
        schedule.streetAddress,
        schedule.area,
        schedule.descDistrict,
        schedule.descPostOffice,
        schedule.pincode
      ].filter(Boolean).join(", "),
      agreement_date: epochOrValueToDate(schedule.dateOfAgreement),
      consideration_value: schedule.valueOfConsideration ?? null,
      stamp_duty_value: schedule.stampDutyValue ?? null,
      property_total_value: schedule.propTotalVal ?? null,
      raw_address: {
        flat_or_building: schedule.flatAddress ?? null,
        street: schedule.streetAddress ?? null,
        area: schedule.area ?? null,
        state: schedule.state ?? null,
        district: schedule.district ?? null,
        post_office: schedule.postOffice ?? null,
        pincode: schedule.pincode ?? null,
        country: schedule.country ?? null
      }
    };
    const transfer = schedule.salePropertyTrnsfrdDetails?.[0] ?? {};
    result.transaction = {
      current_payment_amount: transfer.amtPaidCurrently ?? null,
      payment_date: epochOrValueToDate(transfer.paymentDate),
      deduction_date: epochOrValueToDate(transfer.dateOfDeduction),
      cumulative_previous_installments: transfer.prevInstallment ?? null
    };
    result.tax_deposit = {
      rate_percent: transfer.rateAtDeducted ?? null,
      tds_amount: schedule.taxDepositDetails?.tdsAmnt ?? transfer.amntOfTaxDeductedSource ?? null,
      interest: schedule.taxDepositDetails?.interest ?? null,
      other_fee: schedule.taxDepositDetails?.payableOtherFee ?? null,
      total_amount: schedule.taxDepositDetails?.totalAmt ?? null
    };
    return result;
  }
  throw new Error("Unsupported JSON structure. Use normalized statement JSON or portal Schedule B JSON.");
}

function epochOrValueToDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString().slice(0, 10);
  }
  return normalizeDate(value);
}

export const statementInternals = {
  parseMoney,
  parseRate,
  normalizeDate,
  findLabelValue
};
