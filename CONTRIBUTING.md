# Contributing

Thanks for helping make recurring Form 141 Schedule B preparation safer and
less tedious.

## Never share real filing data

Issues, pull requests, tests, logs, and screenshots must not contain:

- challan statements or HAR files;
- PANs, Aadhaar numbers, names, email addresses, phone numbers, or addresses;
- acknowledgement, CRN, CIN, bank, UPI, or payment references;
- passwords, OTPs, cookies, tokens, hashes, or authorization headers; or
- unredacted Income Tax portal screenshots.

Use generated identifiers and `example.invalid` addresses. When reporting page
matching problems, provide only the unresolved field path and a rewritten,
non-identifying label.

## Development setup

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
npm run check
npm test
npm run build
```

## Pull requests

1. Keep the change focused.
2. Add or update synthetic tests.
3. Run `npm run check` and `npm test`.
4. Explain any permission, storage, network, or portal-interaction change.
5. Update `PRIVACY.md`, `SECURITY.md`, and `CHANGELOG.md` when relevant.

Pull requests that add remote data transmission, credential automation, payment
automation, broad host access, or hidden inference will not be accepted without
an explicit redesign and public discussion.

## Portal matching

Portal labels can change. Prefer:

- preview-first matching;
- narrow label aliases;
- blank-only filling;
- field-path-only diagnostics; and
- no automatic navigation.

Do not add selectors copied from a page if they contain taxpayer or
transaction-specific values.
