(() => {
  if (globalThis.__form141ScheduleBAssistantLoaded) return;
  globalThis.__form141ScheduleBAssistantLoaded = true;

  const api =
    globalThis.__form141CliApi ??
    globalThis.browser ??
    globalThis.chrome;

  if (typeof globalThis.addEventListener === "function" && typeof location !== "undefined") {
    globalThis.addEventListener("message", (event) => {
      if (
        event.source !== globalThis ||
        event.origin !== location.origin ||
        event.data?.source !== "FORM141_DIAGNOSTIC_BRIDGE"
      ) {
        return;
      }
      sendDiagnosticEvent(event.data.record);
    });
  }

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "FORM141_DIAGNOSTIC_CAPTURE") {
      capturePageSnapshot("manual")
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({
          ok: false,
          error: error.message || String(error)
        }));
      return true;
    }
    if (message?.type === "FORM141_DIAGNOSTICS") {
      sendResponse(pageDiagnostics());
      return false;
    }
    if (!["FORM141_PREVIEW", "FORM141_FILL"].includes(message?.type)) return undefined;
    handle(message)
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: error.message,
        matched: 0,
        filled: 0,
        skipped: 0,
        missing: 0,
        unsupported: 0
      }));
    return true;
  });

  let snapshotTimer = null;
  let lastSnapshotSignature = "";
  const scheduleSnapshot = (reason) => {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => capturePageSnapshot(reason), 600);
  };

  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => scheduleSnapshot("dom-content-loaded"),
        { once: true }
      );
    } else {
      scheduleSnapshot("content-script-loaded");
    }

    const observeDocument = () => {
      if (!document.documentElement) return;
      const observer = new MutationObserver(() => scheduleSnapshot("dom-change"));
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled", "aria-disabled", "aria-expanded", "class"]
      });
    };
    if (document.documentElement) {
      observeDocument();
    } else {
      document.addEventListener("DOMContentLoaded", observeDocument, { once: true });
    }
  }

  async function capturePageSnapshot(reason) {
    if (!document.body) return;
    const diagnostics = pageDiagnostics();
    const signature = JSON.stringify({
      page: diagnostics.page,
      flow: diagnostics.flow,
      controls: diagnostics.visibleControls
    });
    if (reason !== "manual" && signature === lastSnapshotSignature) return;
    lastSnapshotSignature = signature;
    await sendDiagnosticEvent({
      kind: "page-snapshot",
      reason,
      flow: diagnostics.flow,
      page: diagnostics.page,
      visibleControls: diagnostics.visibleControls
    });
  }

  async function sendDiagnosticEvent(record) {
    try {
      return await api.runtime.sendMessage({
        type: "FORM141_DIAGNOSTIC_EVENT",
        record
      });
    } catch {
      return null;
    }
  }

  async function handle(message) {
    if (!/^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(location.href)) {
      throw new Error("This extension only fills official Income Tax portal pages.");
    }

    const context = detectContext(message.filing);
    if (
      ["buyer", "seller"].includes(context.section) &&
      Number.isInteger(message.partyIndex) &&
      message.partyIndex >= 0
    ) {
      context.partyIndex = message.partyIndex;
    }
    const allFields = filingFields(message.filing);
    const fields = fieldsForContext(allFields, context);
    const controls = visibleControls(context.root);
    const used = new Set();
    let matched = 0;
    let filled = 0;
    let skipped = 0;
    let missing = 0;
    let unsupported = 0;
    const details = [];

    for (const field of fields) {
      if (field.value == null || field.value === "") continue;
      const match = bestControl(field, controls, used);
      if (!match) {
        missing += 1;
        details.push({ path: field.path, outcome: "missing" });
        continue;
      }

      matched += 1;
      used.add(match.control);
      const matchedControl = {
        controlTag: match.control.tagName.toLowerCase(),
        controlType: match.control.getAttribute("type"),
        controlKeys: match.keys.map(redactDiagnosticText),
        controlLabel: redactDiagnosticText(match.label)
      };
      if (message.type === "FORM141_PREVIEW") {
        details.push({ path: field.path, outcome: "matched", ...matchedControl });
        continue;
      }
      if (!message.overwrite && hasValue(match.control)) {
        skipped += 1;
        details.push({
          path: field.path,
          outcome: "already-populated",
          ...matchedControl
        });
        continue;
      }

      const didFill = await setControl(match.control, field.value, match.label);
      if (didFill) {
        filled += 1;
        details.push({ path: field.path, outcome: "filled", ...matchedControl });
      } else {
        unsupported += 1;
        details.push({
          path: field.path,
          outcome: "unsupported",
          ...matchedControl
        });
      }
    }

    const relevantCount = fields.filter((field) => field.value != null && field.value !== "").length;
    const totalCount = allFields.filter((field) => field.value != null && field.value !== "").length;
    return {
      ok: true,
      mode: message.type === "FORM141_PREVIEW" ? "preview" : "fill",
      flow: context.flow,
      page: context.page,
      matched,
      filled,
      skipped,
      missing,
      unsupported,
      relevant: relevantCount,
      deferred: Math.max(0, totalCount - relevantCount),
      visibleControls: controls.length,
      note: context.note,
      details
    };
  }

  function filingFields(filing) {
    const fields = [];
    const add = (
      path,
      value,
      patterns,
      kind = "text",
      order = 0,
      section = "main",
      keys = []
    ) => {
      fields.push({ path, value, patterns, kind, order, section, keys });
    };

    (filing.buyers ?? []).forEach((buyer, index) => {
      add(
        `buyers[${index}].pan`,
        buyer.pan,
        [/pan of (?:the )?buyer/i, /buyer pan/i, /^pan$/i],
        "text",
        index,
        "buyer",
        ["buyerPan", "panOfBuyer", "pan"]
      );
      add(
        `buyers[${index}].name`,
        buyer.name,
        [/name of (?:the )?buyer/i, /buyer name/i, /^name$/i],
        "text",
        index,
        "buyer",
        ["buyerName", "nameOfBuyer", "name"]
      );
      add(
        `buyers[${index}].share_percentage`,
        buyer.share_percentage,
        [
          /share.*buyer/i,
          /proportion.*buyer/i,
          /proportion of total sale consideration.*buyer/i
        ],
        "number",
        index,
        "buyer",
        ["sharePercentageOfBuyer", "buyerSharePercentage", "sharePercentage"]
      );
      add(
        `buyers[${index}].email`,
        buyer.email,
        [/buyer.*email/i, /email.*buyer/i, /^email(?: id)?$/i],
        "text",
        index,
        "buyer",
        ["buyerEmail", "emailId", "email"]
      );
      add(
        `buyers[${index}].mobile`,
        buyer.mobile,
        [/buyer.*mobile/i, /mobile.*buyer/i, /^(?:mobile|contact)(?: number)?$/i],
        "text",
        index,
        "buyer",
        ["buyerMobile", "mobNum", "mobileNumber"]
      );
    });

    (filing.sellers ?? []).forEach((seller, index) => {
      add(
        `sellers[${index}].pan`,
        seller.pan,
        [/pan of (?:the )?(?:seller|deductee)/i, /seller pan/i, /^pan$/i],
        "text",
        index,
        "seller",
        ["sellerPan", "panOfSeller", "deducteePan", "pan"]
      );
      add(
        `sellers[${index}].name`,
        seller.name,
        [/name of (?:the )?(?:seller|deductee)/i, /seller name/i, /^name$/i],
        "text",
        index,
        "seller",
        ["sellerName", "nameOfSeller", "deducteeName", "name"]
      );
      add(
        `sellers[${index}].share_percentage`,
        seller.share_percentage,
        [
          /share.*seller/i,
          /proportion.*seller/i,
          /proportion of total sale consideration.*seller/i
        ],
        "number",
        index,
        "seller",
        ["sharePercentageOfSeller", "sellerSharePercentage", "sharePercentage"]
      );
      add(
        `sellers[${index}].email`,
        seller.email,
        [/(?:seller|deductee).*email/i, /email.*(?:seller|deductee)/i, /^email(?: id)?$/i],
        "text",
        index,
        "seller",
        ["sellerEmail", "emailId", "email"]
      );
      add(
        `sellers[${index}].mobile`,
        seller.mobile,
        [
          /(?:seller|deductee).*(?:mobile|contact)/i,
          /(?:mobile|contact).*(?:seller|deductee)/i,
          /^(?:mobile|contact)(?: number)?$/i
        ],
        "text",
        index,
        "seller",
        ["sellerMobile", "mobNum", "mobileNumber", "contactNumber"]
      );
    });

    add(
      "meta.tax_year",
      filing.meta?.tax_year,
      [/tax year of transactions/i, /tax year/i],
      "select",
      0,
      "particulars",
      ["taxYear", "taxYearOfTransactions"]
    );
    add(
      "portal.month_of_deduction",
      filing.portal?.month_of_deduction,
      [/month of deduction/i],
      "select",
      0,
      "particulars",
      ["monthOfDeduction"]
    );
    add(
      "portal.nature_transaction",
      filing.portal?.nature_transaction ?? "Schedule B",
      [/nature of transaction/i],
      "select",
      0,
      "particulars",
      ["natureTransaction", "natureOfTransaction"]
    );
    add(
      "portal.deductee_type",
      filing.portal?.deductee_type ?? filing.portal?.property_type_label,
      [/deductee type/i, /corporate deductee/i],
      "radio",
      0,
      "deductee-type",
      ["deducteeType"]
    );

    add(
      "property.property_type",
      filing.property?.property_type,
      [/type of immovable property/i, /property type/i],
      "radio",
      0,
      "main",
      ["propertyType", "typeOfProperty"]
    );
    add(
      "property.address_text",
      filing.property?.address_text,
      [/address of (?:the )?property/i, /property address/i],
      "text",
      0,
      "address",
      ["propertyAddress", "addressOfProperty"]
    );
    add(
      "property.raw_address.flat_or_building",
      filing.property?.raw_address?.flat_or_building,
      [/flat.*building/i, /door.*building/i],
      "text",
      0,
      "main",
      ["flatBuilding", "flatAddress"]
    );
    add(
      "property.raw_address.street",
      filing.property?.raw_address?.street,
      [/road.*street/i, /street.*block.*sector/i],
      "text",
      0,
      "main",
      ["roadStreet", "streetAddress"]
    );
    add(
      "property.raw_address.pincode",
      filing.property?.raw_address?.pincode,
      [/pin code/i, /pincode/i],
      "text",
      0,
      "main",
      ["pincode", "pinCode"]
    );
    add(
      "property.raw_address.post_office",
      filing.property?.raw_address?.post_office,
      [/post office/i],
      "select",
      0,
      "main",
      ["postOffice"]
    );
    add(
      "property.raw_address.area",
      filing.property?.raw_address?.area,
      [/area.*locality/i, /^area$/i],
      "select",
      0,
      "main",
      ["area"]
    );
    add(
      "property.raw_address.district",
      filing.property?.raw_address?.district,
      [/district/i],
      "select",
      0,
      "main",
      ["district"]
    );
    add(
      "property.agreement_date",
      filing.property?.agreement_date,
      [/date of agreement/i, /agreement.*date/i],
      "date",
      0,
      "main",
      ["dateOfAgreement", "agreementDate"]
    );
    add(
      "property.consideration_value",
      filing.property?.consideration_value,
      [
        /total (?:sale )?consideration/i,
        /value of consideration/i,
        /total sale consideration in respect of the property/i
      ],
      "number",
      0,
      "main",
      [
        "considerationValue",
        "valueOfConsideration",
        "totalSaleConsideration",
        "propertyValue"
      ]
    );
    add(
      "property.stamp_duty_value",
      filing.property?.stamp_duty_value,
      [/total stamp duty value/i, /stamp duty value/i],
      "number",
      0,
      "main",
      ["stampDutyValue", "totalStampDutyValue"]
    );
    add(
      "property.proportionate_stamp_duty_value",
      filing.property?.proportionate_stamp_duty_value,
      [/proportionate.*stamp duty/i],
      "number",
      0,
      "auto",
      ["proportionateSDV", "proportionateStampDutyValue"]
    );

    add(
      "portal.installment_payment_type",
      filing.portal?.installment_payment_type,
      [/payment.*lumpsum.*instal/i, /lumpsum or instal/i],
      "radio",
      0,
      "main",
      ["paymentOfInstallment", "paymentMode"]
    );
    add(
      "portal.installment_sequence",
      filing.portal?.installment_sequence,
      [/first.*subsequent.*last instal/i, /instalment type/i],
      "radio",
      0,
      "main",
      ["installmentType", "installmentSequence"]
    );
    add(
      "meta.previous_acknowledgement_number",
      filing.meta?.previous_acknowledgement_number,
      [/previous acknowledgement/i, /previous acknowledgment/i],
      "text",
      0,
      "main",
      [
        "prevAckNum",
        "previousAckNumber",
        "previousAcknowledgementNumber"
      ]
    );

    const transactionPan =
      filing.transaction?.deductee_pan ??
      filing.sellers?.[0]?.pan;
    add(
      "transaction.deductee_pan",
      transactionPan,
      [/pan of (?:the )?(?:seller|deductee)/i, /seller pan/i],
      "select",
      0,
      "transaction",
      ["sellerPan", "deducteePan", "panOfSeller"]
    );
    add(
      "transaction.cumulative_previous_installments",
      filing.transaction?.cumulative_previous_installments,
      [/amount.*previous instal/i, /previous instal.*amount/i],
      "number",
      0,
      "transaction",
      [
        "prevInstallment",
        "previousInstallments",
        "totalAmountPaidPrevInstallments"
      ]
    );
    add(
      "transaction.current_payment_amount",
      filing.transaction?.current_payment_amount,
      [
        /amount.*present (?:transaction|instal)/i,
        /amount paid currently/i,
        /current payment amount/i,
        /amount paid\/credited currently/i
      ],
      "number",
      0,
      "transaction",
      ["amtPaidCurrently", "amountPaidCurrently", "currentPaymentAmount"]
    );
    add(
      "transaction.tax_liable_amount",
      filing.transaction?.tax_liable_amount,
      [/amount on which tax/i, /tax liable amount/i, /tax is required to be deducted/i],
      "number",
      0,
      "transaction",
      ["taxLiableAmount", "amountTaxRequired", "amountLiableForTax"]
    );
    add(
      "transaction.payment_date",
      filing.transaction?.payment_date,
      [/date of (?:credit\/)?payment/i, /date of payment/i, /payment.*date/i],
      "date",
      0,
      "transaction",
      ["paymentDate", "dateOfPayment"]
    );
    add(
      "transaction.deduction_date",
      filing.transaction?.deduction_date,
      [/date of deduction/i, /deduction.*date/i],
      "date",
      0,
      "transaction",
      ["dateOfDeduction", "deductionDate"]
    );
    add(
      "transaction.section_395_applicable",
      filing.transaction?.section_395_applicable,
      [/section 395.*applicable/i],
      "radio",
      0,
      "transaction",
      ["section395Applicable"]
    );
    add(
      "transaction.section_395_certificate",
      filing.transaction?.section_395_certificate,
      [/certificate.*section 395/i],
      "text",
      0,
      "transaction",
      ["certificateNo", "section395Certificate"]
    );
    add(
      "tax_deposit.rate_percent",
      filing.tax_deposit?.rate_percent,
      [/rate at which tax/i, /rate of deduction/i, /tds rate/i],
      "number",
      0,
      "transaction",
      ["rateAtDeducted", "tdsRate"]
    );
    add(
      "tax_deposit.tds_amount",
      filing.tax_deposit?.tds_amount,
      [/amount of tax deducted/i, /amount deducted/i, /tds amount/i],
      "number",
      0,
      "transaction",
      [
        "amtTDSDeducted",
        "tdsAmnt",
        "amountDeducted",
        "amountTaxDeducted"
      ]
    );
    add(
      "tax_deposit.interest",
      filing.tax_deposit?.interest,
      [/^(?:\(b\) )?interest$/i, /interest amount/i],
      "number",
      0,
      "tax",
      ["interest", "interestAmount"]
    );
    add(
      "tax_deposit.other_fee",
      filing.tax_deposit?.other_fee,
      [/^(?:\(c\) )?fee$/i, /other fee/i],
      "number",
      0,
      "tax",
      ["payableOtherFee", "fee", "otherFee"]
    );
    add(
      "tax_deposit.total_amount",
      filing.tax_deposit?.total_amount,
      [/total amount/i, /total payable/i, /total payment/i],
      "number",
      0,
      "auto",
      ["totalAmt", "totalAmount"]
    );
    return fields;
  }

  function detectContext(filing) {
    const bodyText = normalize(document.body?.innerText);
    const dialog = visibleDialog();
    const dialogText = normalize(dialog?.innerText);
    const isForm141 =
      /form 141/.test(bodyText) ||
      /schedule b.*393/.test(bodyText) ||
      (
        /tax year of transactions/.test(bodyText) &&
        /month of deduction/.test(bodyText) &&
        /nature of transaction/.test(bodyText)
      ) ||
      (
        /details of all buyers/.test(bodyText) &&
        /details of all deductees/.test(bodyText) &&
        /total sale consideration/.test(bodyText)
      );

    const isLegacy26qb =
      /form 26qb/.test(bodyText) ||
      /section 194.?ia/.test(bodyText) ||
      (
        /tax applicable/.test(bodyText) &&
        /transfer of immovable property/.test(bodyText)
      );

    const inlineEditor = visibleInlineEditor(filing, bodyText);
    if (inlineEditor) return inlineEditor;

    if (!isForm141 && isLegacy26qb) {
      return {
        flow: "legacy-26qb",
        page: "current legacy 26QB page",
        section: "legacy",
        root: document,
        note: null
      };
    }
    if (!isForm141) {
      return {
        flow: "unrecognized",
        page: "unrecognized page (not a rendered Form 141 form)",
        section: "unknown",
        root: document,
        note:
          "No filing fields were targeted. Close any View Source/HTML tab and foreground the rendered Form 141 portal tab."
      };
    }

    if (dialog) {
      if (
        /corporate deductee/.test(dialogText) &&
        /non.?corporate deductee/.test(dialogText) &&
        !/(?:buyer|seller) details/.test(dialogText)
      ) {
        return {
          flow: "form-141-schedule-b",
          page: "Form 141 deductee type dialog",
          section: "deductee-type",
          root: dialog,
          note: "Review the deductee category, then use the portal's Continue action yourself."
        };
      }
      if (
        /pan of (?:seller|deductee)/.test(dialogText) &&
        /amount (?:paid|credited)|date of (?:credit|payment)|tax/.test(dialogText)
      ) {
        return {
          flow: "form-141-schedule-b",
          page: "Transaction Add Details dialog",
          section: "transaction",
          root: dialog,
          note: "Review the row, then use the portal's Add/Save action yourself."
        };
      }
      if (/buyer/.test(dialogText)) {
        return {
          flow: "form-141-schedule-b",
          page: "Buyer Add Details dialog",
          section: "buyer",
          partyIndex: firstMissingPartyIndex(filing.buyers, bodyText),
          root: dialog,
          note: "Review this buyer row before it is added."
        };
      }
      if (/(?:seller|deductee)/.test(dialogText)) {
        return {
          flow: "form-141-schedule-b",
          page: "Seller Add Details dialog",
          section: "seller",
          partyIndex: firstMissingPartyIndex(filing.sellers, bodyText),
          root: dialog,
          note: "Review this seller row before it is added."
        };
      }
      return {
        flow: "form-141-schedule-b",
        page: "open Form 141 dialog",
        section: "dialog",
        root: dialog,
        note: "This dialog is not recognized yet; no unrelated page fields were targeted."
      };
    }

    if (
      /tax year of transactions/.test(bodyText) &&
      /month of deduction/.test(bodyText) &&
      /nature of transaction/.test(bodyText)
    ) {
      return {
        flow: "form-141-schedule-b",
        page: "Form 141 particulars page",
        section: "particulars",
        root: document,
        note: "Review these selections, then use the portal's Continue action yourself."
      };
    }

    return {
      flow: "form-141-schedule-b",
      page: "Form 141 Schedule B transaction page",
      section: "main",
      root: document,
      note:
        "Buyer, seller, and transaction rows are inside separate Add Details dialogs. Open one dialog and run Preview/Fill again. The combined property address remains manual."
    };
  }

  function visibleInlineEditor(filing, bodyText) {
    const shareControls = [...document.querySelectorAll(
      "input[name='sharePercentage'], input[formcontrolname='sharePercentage']"
    )].filter(isVisible);
    const buyerShare = shareControls.find((control) =>
      /paid\/credited by the buyer/i.test(descriptor(control))
    );
    if (buyerShare) {
      return {
        flow: "form-141-schedule-b",
        page: "Buyer Add Details inline editor",
        section: "buyer",
        partyIndex: firstMissingPartyIndex(filing.buyers, bodyText),
        root: inlineEditorRoot(buyerShare),
        note: "Review this buyer row, then use the portal's Add action."
      };
    }

    const sellerShare = shareControls.find((control) =>
      /received\/debited by the seller/i.test(descriptor(control))
    );
    if (sellerShare) {
      return {
        flow: "form-141-schedule-b",
        page: "Seller Add Details inline editor",
        section: "seller",
        partyIndex: firstMissingPartyIndex(filing.sellers, bodyText),
        root: inlineEditorRoot(sellerShare),
        note: "Review this seller row, then use the portal's Add action."
      };
    }

    const sellerPan = [...document.querySelectorAll(
      "select[name='sellerPan'], select[formcontrolname='sellerPan']"
    )].find(isVisible);
    if (sellerPan) {
      return {
        flow: "form-141-schedule-b",
        page: "Transaction Add Details inline editor",
        section: "transaction",
        root: inlineEditorRoot(sellerPan),
        note: "Review this transaction row, then use the portal's Add action."
      };
    }
    return null;
  }

  function inlineEditorRoot(control) {
    let candidate = control.parentElement;
    while (candidate && candidate !== document.body) {
      const actionTexts = [...candidate.querySelectorAll("button")]
        .filter(isVisible)
        .map((button) => normalize(button.textContent));
      if (
        actionTexts.some((text) => /^add$/.test(text)) &&
        actionTexts.some((text) => /^cancel$/.test(text))
      ) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return control.closest("form") ?? control.parentElement ?? document;
  }

  function fieldsForContext(fields, context) {
    if (context.section === "legacy") return fields;
    if (context.section === "main") {
      return fields.filter((field) => ["main", "tax"].includes(field.section));
    }
    if (["particulars", "deductee-type"].includes(context.section)) {
      return fields.filter((field) => field.section === context.section);
    }
    if (["buyer", "seller"].includes(context.section)) {
      const prefix = `${context.section === "buyer" ? "buyers" : "sellers"}[${context.partyIndex ?? 0}]`;
      return fields.filter((field) => field.path.startsWith(prefix));
    }
    if (context.section === "transaction") {
      return fields.filter((field) => field.section === "transaction");
    }
    return [];
  }

  function firstMissingPartyIndex(parties = [], pageText = "") {
    const normalizedPage = compact(pageText);
    const missing = parties.findIndex((party) => {
      const pan = compact(party?.pan);
      return pan && !normalizedPage.includes(pan);
    });
    return missing >= 0 ? missing : 0;
  }

  function visibleDialog() {
    const selectors = [
      "[role='dialog']",
      "[aria-modal='true']",
      "mat-dialog-container",
      ".mat-mdc-dialog-container",
      ".cdk-overlay-pane",
      ".modal.show"
    ];
    return [...document.querySelectorAll(selectors.join(", "))]
      .find((candidate) => isVisible(candidate)) ?? null;
  }

  function visibleControls(root = document) {
    return [...root.querySelectorAll(
      "input:not([type='hidden']), textarea, select, [role='combobox'], mat-select, ng-select"
    )]
      .filter((control) => {
        if (control.disabled || control.getAttribute("aria-disabled") === "true") return false;
        if (control.closest("ng-select, mat-select") && !control.matches("ng-select, mat-select")) {
          return false;
        }
        return isVisible(control);
      })
      .map((control) => ({
        control,
        label: descriptor(control),
        keys: controlKeys(control)
      }));
  }

  function pageDiagnostics() {
    const context = detectContext({});
    const controls = visibleControls(context.root).map(({ control, label, keys }) => ({
      tag: control.tagName.toLowerCase(),
      type: control.getAttribute("type"),
      role: control.getAttribute("role"),
      keys: keys.map(redactDiagnosticText),
      label: redactDiagnosticText(label),
      populated: hasValue(control),
      readOnly: Boolean(control.readOnly),
      ariaInvalid: control.getAttribute("aria-invalid"),
      classes: redactDiagnosticText(control.className)
    }));
    const actions = [...context.root.querySelectorAll(
      "button, a[role='button'], input[type='button'], input[type='submit'], [role='button']"
    )]
      .filter(isVisible)
      .map((control) => ({
        tag: control.tagName.toLowerCase(),
        type: control.getAttribute("type"),
        role: control.getAttribute("role"),
        id: redactDiagnosticText(control.id),
        name: redactDiagnosticText(control.getAttribute("name")),
        ariaLabel: redactDiagnosticText(control.getAttribute("aria-label")),
        text: redactDiagnosticText(control.textContent),
        disabled:
          Boolean(control.disabled) ||
          control.getAttribute("aria-disabled") === "true"
      }));
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      origin: location.origin,
      flow: context.flow,
      page: context.page,
      visibleControls: controls,
      visibleActions: actions
    };
  }

  function redactDiagnosticText(value) {
    return String(value ?? "")
      .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[PAN]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
      .replace(/\b\d{10,}\b/g, "[NUMBER]")
      .slice(0, 400);
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none";
  }

  function descriptor(control) {
    const parts = [
      control.getAttribute("aria-label"),
      control.getAttribute("placeholder"),
      control.getAttribute("title"),
      ...controlKeys(control)
    ];

    for (const id of (control.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean)) {
      parts.push(document.getElementById(id)?.textContent);
    }
    if (control.labels) {
      parts.push(...[...control.labels].map((label) => label.textContent));
    }
    if (control.id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (explicit) parts.push(explicit.textContent);
    }

    const container = control.closest(
      "mat-form-field, .mat-form-field, .mat-mdc-form-field, .form-group, .field, fieldset, td"
    );
    if (container) {
      parts.push(
        ...[...container.querySelectorAll(
          "label, mat-label, legend, .mat-form-field-label, .mdc-floating-label"
        )].slice(0, 6).map((label) => label.textContent)
      );
    }
    const previous = control.parentElement?.previousElementSibling;
    if (previous?.matches("label, mat-label, legend, p, span")) {
      parts.push(previous.textContent);
    }

    return [...new Set(parts.filter(Boolean).map((part) => part.trim()).filter(Boolean))]
      .join(" · ")
      .slice(0, 400);
  }

  function controlKeys(control) {
    return [
      control.getAttribute("name"),
      control.getAttribute("formcontrolname"),
      control.getAttribute("ng-reflect-name"),
      control.getAttribute("data-field"),
      control.id
    ].filter(Boolean);
  }

  function bestControl(field, controls, used) {
    const candidates = controls
      .filter(({ control }) => !used.has(control) && compatible(field, control))
      .map((entry) => {
        const patternMatches = field.patterns.filter((pattern) => {
          pattern.lastIndex = 0;
          return pattern.test(entry.label);
        }).length;
        const keyMatches = field.keys.filter((key) =>
          entry.keys.some((entryKey) => compact(entryKey) === compact(key))
        ).length;
        const optionMatches = field.kind === "radio" &&
          optionLabelMatches(entry, field.value)
          ? 1
          : 0;
        return {
          ...entry,
          score:
            patternMatches * 20 +
            keyMatches * 35 +
            optionMatches * 50 -
            entry.label.length / 1000
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (field.kind === "radio") return candidates[0] ?? null;
    return candidates[field.order] ?? candidates[0] ?? null;
  }

  function compatible(field, control) {
    const type = control.getAttribute("type")?.toLowerCase();
    if (field.kind === "radio") return type === "radio";
    if (type === "radio" || type === "checkbox") return false;
    if (field.kind === "select") {
      return control.matches("select, [role='combobox'], mat-select, ng-select");
    }
    return true;
  }

  function optionLabelMatches(entry, value) {
    const normalizedWanted = normalize(value);
    const rawLabel =
      `${entry.label} ${entry.control.value ?? ""} ` +
      `${entry.control.getAttribute("aria-label") ?? ""}`;
    if (["yes", "no"].includes(normalizedWanted)) {
      return new RegExp(`(?:^|\\W)${normalizedWanted}(?:$|\\W)`, "i")
        .test(rawLabel);
    }
    const wanted = compactSingular(value);
    const label = compactSingular(rawLabel);
    return Boolean(wanted && label.includes(wanted));
  }

  function hasValue(control) {
    if (control.matches("input[type='radio'], input[type='checkbox']")) {
      return control.checked;
    }
    if (control.matches("input, textarea, select")) {
      return String(control.value ?? "").trim() !== "";
    }
    const text = String(control.textContent ?? "").trim();
    const placeholder = String(control.getAttribute("placeholder") ?? "").trim();
    return Boolean(text && text !== placeholder);
  }

  async function setControl(control, value, label) {
    if (control.matches("input[type='radio']")) {
      if (!optionLabelMatches({ control, label }, value)) return false;
      control.click();
      dispatch(control);
      return control.checked;
    }
    if (control.tagName === "SELECT") {
      const option = matchingOption([...control.options], value);
      if (!option) return false;
      control.value = option.value;
      dispatch(control);
      return true;
    }
    if (control.matches("input, textarea")) {
      const formatted = formatForControl(control, value, label);
      const prototype = control.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(control, formatted);
      dispatch(control);
      return String(control.value) === formatted;
    }
    if (control.matches("[role='combobox'], mat-select, ng-select")) {
      control.click();
      const options = await waitForOptions();
      const option = matchingOption(options, value);
      if (!option) return false;
      option.click();
      return true;
    }
    return false;
  }

  function matchingOption(options, value) {
    const wanted = compactSingular(value);
    return options.find((candidate) => compactSingular(candidate.textContent) === wanted) ??
      options.find((candidate) => compactSingular(candidate.getAttribute?.("value")) === wanted) ??
      options.find((candidate) => compactSingular(candidate.textContent).includes(wanted));
  }

  async function waitForOptions() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const options = [...document.querySelectorAll(
        "[role='option'], mat-option, .mat-mdc-option, .ng-option"
      )].filter(isVisible);
      if (options.length) return options;
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
    return [];
  }

  function formatForControl(control, value, label) {
    if (control.type === "date") return String(value);
    const isPortalDateControl =
      control.classList.contains("mat-datepicker-input") ||
      /date/i.test(
        `${label} ${control.getAttribute("formcontrolname") ?? ""} ` +
        `${control.getAttribute("name") ?? ""}`
      );
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(String(value)) &&
      (
        isPortalDateControl ||
        /dd.?mm.?yyyy/i.test(control.placeholder ?? "")
      )
    ) {
      const [year, month, day] = String(value).split("-");
      return `${day}/${month}/${year}`;
    }
    if (/amount|value|rate|share|proportion|interest|fee|total/i.test(label)) {
      return String(value).replace(/[₹,%\s]/g, "");
    }
    return String(value);
  }

  function dispatch(control) {
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    control.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function compact(value) {
    return normalize(value).replace(/[^a-z0-9]/g, "");
  }

  function compactSingular(value) {
    return compact(value)
      .replace(/installments?/g, "instalment")
      .replace(/instalments?/g, "instalment")
      .replace(/deductees/g, "deductee");
  }
})();
