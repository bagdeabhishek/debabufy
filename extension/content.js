(() => {
  if (globalThis.__tds26qbAssistantLoaded) return;
  globalThis.__tds26qbAssistantLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["TDS26QB_PREVIEW", "TDS26QB_FILL"].includes(message?.type)) return undefined;
    handle(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message, matched: 0, skipped: 0, missing: 0 }));
    return true;
  });

  async function handle(message) {
    if (!/^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(location.href)) {
      throw new Error("This extension only fills official Income Tax portal pages.");
    }
    const fields = filingFields(message.filing);
    const controls = visibleControls();
    const used = new Set();
    let matched = 0;
    let skipped = 0;
    let missing = 0;
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
      if (message.type === "TDS26QB_PREVIEW") {
        details.push({ path: field.path, outcome: "matched", label: match.label });
        continue;
      }
      if (!message.overwrite && hasValue(match.control)) {
        skipped += 1;
        details.push({ path: field.path, outcome: "already-populated", label: match.label });
        continue;
      }
      const filled = await setControl(match.control, field.value, match.label);
      details.push({ path: field.path, outcome: filled ? "filled" : "unsupported", label: match.label });
      if (!filled) missing += 1;
    }
    return {
      ok: true,
      mode: message.type === "TDS26QB_PREVIEW" ? "preview" : "fill",
      matched,
      skipped,
      missing,
      details
    };
  }

  function filingFields(filing) {
    const fields = [];
    const add = (path, value, patterns, kind = "text", order = 0) => {
      fields.push({ path, value, patterns, kind, order });
    };

    (filing.buyers ?? []).forEach((buyer, index) => {
      add(`buyers[${index}].pan`, buyer.pan, [/pan of (?:the )?buyer/i, /buyer pan/i], "text", index);
      add(`buyers[${index}].name`, buyer.name, [/name of (?:the )?buyer/i, /buyer name/i], "text", index);
      add(`buyers[${index}].share_percentage`, buyer.share_percentage, [/share.*buyer/i, /proportion.*buyer/i], "number", index);
      add(`buyers[${index}].email`, buyer.email, [/buyer.*email/i, /email.*buyer/i], "text", index);
      add(`buyers[${index}].mobile`, buyer.mobile, [/buyer.*mobile/i, /mobile.*buyer/i], "text", index);
    });
    (filing.sellers ?? []).forEach((seller, index) => {
      add(`sellers[${index}].pan`, seller.pan, [/pan of (?:the )?(?:seller|deductee)/i, /seller pan/i], "text", index);
      add(`sellers[${index}].name`, seller.name, [/name of (?:the )?(?:seller|deductee)/i, /seller name/i], "text", index);
      add(`sellers[${index}].share_percentage`, seller.share_percentage, [/share.*seller/i, /proportion.*seller/i], "number", index);
      add(`sellers[${index}].email`, seller.email, [/(?:seller|deductee).*email/i, /email.*(?:seller|deductee)/i], "text", index);
      add(`sellers[${index}].mobile`, seller.mobile, [/(?:seller|deductee).*(?:mobile|contact)/i, /(?:mobile|contact).*(?:seller|deductee)/i], "text", index);
    });

    add("property.property_type", filing.property?.property_type, [/type of immovable property/i, /property type/i], "select");
    add("property.address_text", filing.property?.address_text, [/address of (?:the )?property/i, /property address/i], "text");
    add("property.agreement_date", filing.property?.agreement_date, [/date of agreement/i, /agreement.*date/i], "date");
    add("property.consideration_value", filing.property?.consideration_value, [/total (?:sale )?consideration/i, /value of consideration/i], "number");
    add("property.stamp_duty_value", filing.property?.stamp_duty_value, [/stamp duty value/i], "number");
    add("property.proportionate_stamp_duty_value", filing.property?.proportionate_stamp_duty_value, [/proportionate.*stamp duty/i], "number");

    add("meta.previous_acknowledgement_number", filing.meta?.previous_acknowledgement_number, [/previous acknowledgement/i, /previous acknowledgment/i], "text");
    add("transaction.cumulative_previous_installments", filing.transaction?.cumulative_previous_installments, [/amount.*previous instal/i, /previous instal.*amount/i], "number");
    add("transaction.current_payment_amount", filing.transaction?.current_payment_amount, [/amount.*present instal/i, /amount paid currently/i, /current payment amount/i], "number");
    add("transaction.tax_liable_amount", filing.transaction?.tax_liable_amount, [/amount on which tax/i, /tax liable amount/i], "number");
    add("transaction.payment_date", filing.transaction?.payment_date, [/date of payment/i, /payment.*date/i], "date");
    add("transaction.deduction_date", filing.transaction?.deduction_date, [/date of deduction/i, /deduction.*date/i], "date");
    add("tax_deposit.rate_percent", filing.tax_deposit?.rate_percent, [/rate at which tax/i, /rate of deduction/i, /tds rate/i], "number");
    add("tax_deposit.tds_amount", filing.tax_deposit?.tds_amount, [/amount of tax deducted/i, /tds amount/i], "number");
    add("tax_deposit.interest", filing.tax_deposit?.interest, [/^interest$/i, /interest amount/i], "number");
    add("tax_deposit.other_fee", filing.tax_deposit?.other_fee, [/^fee$/i, /other fee/i], "number");
    add("tax_deposit.total_amount", filing.tax_deposit?.total_amount, [/total amount/i, /total payable/i], "number");
    return fields;
  }

  function visibleControls() {
    return [...document.querySelectorAll("input, textarea, select, [role='combobox'], mat-select")]
      .filter((control) => {
        if (control.disabled || control.getAttribute("aria-disabled") === "true") return false;
        const rect = control.getBoundingClientRect();
        const style = getComputedStyle(control);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((control) => ({ control, label: descriptor(control) }));
  }

  function descriptor(control) {
    const parts = [
      control.getAttribute("aria-label"),
      control.getAttribute("placeholder"),
      control.getAttribute("name"),
      control.getAttribute("formcontrolname"),
      control.id
    ];
    if (control.labels) parts.push(...[...control.labels].map((label) => label.textContent));
    if (control.id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (explicit) parts.push(explicit.textContent);
    }
    const container = control.closest("mat-form-field, .mat-form-field, .form-group, .field, td, fieldset");
    if (container) {
      const label = container.querySelector("label, mat-label, legend, .mat-form-field-label");
      if (label) parts.push(label.textContent);
    }
    return [...new Set(parts.filter(Boolean).map((part) => part.trim()).filter(Boolean))]
      .join(" · ")
      .slice(0, 240);
  }

  function bestControl(field, controls, used) {
    const candidates = controls
      .filter(({ control }) => !used.has(control))
      .map((entry) => {
        const matches = field.patterns.filter((pattern) => pattern.test(entry.label));
        return { ...entry, score: matches.length * 10 - entry.label.length / 1000 };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
    return candidates[field.order] ?? candidates[0] ?? null;
  }

  function hasValue(control) {
    if (control.matches("input, textarea, select")) return String(control.value ?? "").trim() !== "";
    return String(control.textContent ?? "").trim() !== "";
  }

  async function setControl(control, value, label) {
    if (control.tagName === "SELECT") {
      const wanted = normalize(value);
      const option = [...control.options].find((candidate) =>
        normalize(candidate.textContent).includes(wanted) || normalize(candidate.value) === wanted
      );
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
      return true;
    }
    // Custom Angular select: intentionally left for user review in this MVP.
    return false;
  }

  function formatForControl(control, value, label) {
    if (control.type === "date") return String(value);
    if (/dd.?mm.?yyyy/i.test(control.placeholder ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
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
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  }
})();
