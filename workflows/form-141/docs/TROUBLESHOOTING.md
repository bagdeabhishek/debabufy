# Form 141 troubleshooting

## The statement cannot be read

- Confirm it is the previous Form 141 Schedule B challan statement, not a
  screenshot, payment receipt, or Form 132 certificate.
- Try `../examples/synthetic-statement.json` to distinguish an installation
  problem from a changed PDF layout.
- Do not upload the real statement to a public issue.

## Chrome was not found

Install Google Chrome in its standard location and restart DeBabufy. On Windows,
machine-wide and per-user Chrome installations are detected.

Advanced users can start Chrome manually using
[these instructions](ATTACH_EXISTING_CHROME.md).

## DeBabufy cannot connect to Chrome

Close every Chrome window opened by DeBabufy, restart the desktop application,
and press **Open Chrome** again. Another program may already be using local port
9222.

## No Income Tax portal tab was found

Use the Chrome window opened by DeBabufy—not a different everyday Chrome
window. Open the Income Tax portal and log in there.

## Open the main Form 141 Schedule B page

The current alpha automates the tested form and detail editors, but not the
navigation from the portal dashboard. Navigate to Form 141 Schedule B and close
any open Add Details editor before pressing **Start Form 141 workflow**.

## A field or detail editor failed

The portal may have changed. DeBabufy fails closed and attempts to save a local
diagnostic page map. Press **Open diagnostic folder**, inspect and redact the
file, and report the DeBabufy version, operating system, Chrome version,
workflow stage, and rewritten synthetic labels.

Never post a real statement, diagnostic file, PAN, name, contact detail,
address, acknowledgement number, payment reference, cookie, token, HAR,
browser profile, or unredacted screenshot.

## Security problems

Do not open a public issue. Follow the repository
[security policy](../../../SECURITY.md).
