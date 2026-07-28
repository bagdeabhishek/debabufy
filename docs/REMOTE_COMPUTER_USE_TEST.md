# Remote computer-use diagnostic run

Use this runbook on the Windows machine that has the authenticated browser. The
goal is to exercise Form 141 Schedule B through the normal browser, capture a
value-redacted diagnostic report, and stop before challan finalization or
payment.

## What must be available on the remote machine

- the latest unpacked Chrome extension build from `dist/chrome`;
- normal Google Chrome with the extension loaded;
- the previous Form 141 Schedule B challan statement;
- the current payment amount and date; and
- a Codex desktop task with Computer Use capable of controlling that Chrome
  window.

If the Codex task can only operate its bundled in-app browser and cannot control
the installed Chrome window, stop. The filing extension and the authenticated
Chrome session must be in the browser that the agent can actually operate.

## Manual setup before handing control to Codex

1. Open `chrome://extensions`.
2. Enable Developer mode and load `dist/chrome` unpacked.
3. Reload the extension if it was already installed.
4. Open the Income Tax portal in normal Chrome and log in manually. Do not give
   credentials, CAPTCHA answers, OTPs, cookies, tokens, or recovery codes to
   Codex.
5. Navigate to Form 141 → Schedule B → Particulars.
6. Open the extension and select **Start recording** under **Redacted
   diagnostic session**.
7. Select the previous statement, enter the current amount and date, and choose
   **Analyze locally**. File selection is manual.
8. Review the proposal and tick the review confirmation only if it is correct.
9. Leave Chrome on the Form 141 page and start the Codex desktop task with the
   prompt below.

## Prompt for the Codex desktop task

```text
Use Computer Use to test the Form 141 Schedule B Assistant in the already-open,
already-authenticated normal Chrome window.

Goal:
- exercise the complete draft-preparation workflow;
- use the extension's Preview and Fill controls on every relevant Form 141 page
  and Buyer, Seller, and Transaction Add Details dialog;
- save draft rows and navigate through the portal where required;
- record every mismatch or blocked step;
- stop before challan finalization, submission, payment creation, bank/UPI
  selection, Pay Now, OTP, or payment authorization.

Authority and boundaries:
- I authorize filling fields and using Add/Save/Continue only while the filing
  remains a draft.
- Never enter credentials, CAPTCHA, OTP, bank details, UPI details, or payment
  authorization.
- Never click Submit, Finalize, Proceed to Pay, Pay Now, or an equivalent
  control.
- Never call or replay an endpoint containing challandetl/save,
  challan/pay/create, payment authorization, or bank authorization.
- Never modify request headers, cookies, tokens, or browser security settings.
- Do not open DevTools or paste console scripts.
- Do not attach or quote PANs, names, contact details, addresses, amounts,
  acknowledgement numbers, CRNs, cookies, tokens, or unredacted screenshots in
  the final report.

Procedure:
1. Confirm the extension's diagnostic status says Recording.
2. Open the extension and select Capture current page.
3. On each Form 141 page or dialog:
   a. select Preview matches;
   b. record the page name, matched count, missing field paths, unsupported field
      paths, and deferred count without recording values;
   c. if Preview is plausible, select Fill blank fields;
   d. visually verify that intended controls changed and unrelated controls did
      not;
   e. use the portal's Add or Save only for the current draft row;
   f. reopen the saved row and verify that the portal retained it.
4. Cover, in order: Particulars, main Schedule B/property details, every Buyer
   row, every Seller row, every Transaction row, and tax/interest/fee summary.
5. After each page transition or dialog, use Capture current page.
6. If a step fails, retry it at most twice using a fresh page/dialog. Record the
   exact visible error text after redacting identifiers and numbers.
7. If navigation reaches a final review or payment boundary, capture the page
   and stop without clicking the finalizing/payment control.
8. Open the extension and select Stop & download. Preserve the downloaded
   form-141-diagnostics-*.json file.
9. Create form141-computer-use-report.md beside the downloaded diagnostic file
   using the required report format below.

Required final report:
- Result: completed to payment boundary / blocked / stopped for safety
- Browser and extension version
- Last safe portal page reached
- Ordered step table: page/dialog, Preview counts, Fill counts, portal save
  result, retry count
- Unresolved normalized field paths
- API endpoint/status table using endpoint paths only
- Request/response schema differences using JSON key paths only
- Error categories and where they appeared; manually note visible portal errors
  only after removing all values and identifiers
- Duplicate draft count if visible, but no draft references
- Exact stop reason
- Diagnostic JSON filename
- Recommended next engineering change

Return the Markdown report and diagnostic JSON to the user. Do not submit,
finalize, or pay even if the portal appears ready.
```

## Required report template

```markdown
# Form 141 computer-use diagnostic report

## Outcome

- Result:
- Browser:
- Extension:
- Last safe page:
- Stop reason:
- Diagnostic JSON:

## Step results

| Step | Page/dialog | Preview | Fill | Draft save | Retries | Observation |
| --- | --- | --- | --- | --- | --- | --- |

## Unresolved field paths

- None recorded

## API trace

| Endpoint path | Method | Status | Request schema | Response schema |
| --- | --- | --- | --- | --- |

## Redacted errors

- None recorded (the JSON records error categories, not potentially sensitive
  browser error text)

## Recommended engineering change

-
```

## Privacy check before sharing the report

Open the JSON and Markdown files locally and search for:

- PANs;
- email addresses;
- phone numbers;
- property addresses;
- acknowledgement or draft references;
- CRNs;
- amounts;
- cookies, headers, tokens, or authorization data.

The extension recorder is designed not to collect those values, but review the
files before attaching them. Never share screenshots from the live portal
unless they have been manually redacted.
