# Security policy

## Supported versions

DeBabufy is alpha software. Security fixes are applied to the latest release and
the `main` branch.

## Report a vulnerability privately

Do not open a public issue. Use
[GitHub private vulnerability reporting](https://github.com/bagdeabhishek/debabufy/security/advisories/new)
and use synthetic reproduction data.

Never include a real statement, PAN, Aadhaar number, address, credential, OTP,
payment reference, cookie, token, HAR, browser profile, or unredacted screenshot.

## Security boundaries

DeBabufy must:

- keep Electron context isolation and renderer sandboxing enabled;
- keep Node.js unavailable to renderer pages;
- reject IPC messages from untrusted pages;
- refuse non-loopback Chrome debugging endpoints;
- use a dedicated non-default Chrome profile;
- fail closed when a portal screen is not recognised;
- avoid telemetry and remote filing-data storage;
- never automate credentials, CAPTCHA, OTP, submission, or payment; and
- never load unsigned remote workflow code.

Changes affecting these boundaries require security review.
