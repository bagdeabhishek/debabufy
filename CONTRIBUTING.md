# Contributing to DeBabufy

Thanks for helping remove unnecessary `chakkar`.

## Before you begin

- Search existing issues before opening a new one.
- Use synthetic or fully redacted data.
- Never post credentials, PANs, Aadhaar numbers, addresses, cookies, tokens,
  challan references, payment details, HAR files, or browser profiles.
- Keep workflows human-supervised and stop before irreversible actions.
- Do not bypass authentication, CAPTCHA, OTP, rate limits, or portal controls.

## Local development

```sh
npm install
npm test
npm start
```

Build the unpacked desktop application with:

```sh
npm run pack
```

## Adding a workflow

Create `workflows/<workflow-id>/` containing:

- `workflow.json` with its identity, supported official domains, inputs, and
  safety capabilities;
- `index.js` exporting `manifest`, `prepare(input)`, and `run(context)`;
- a `README.md` describing prerequisites, exact boundaries, and test steps;
- deterministic tests and synthetic fixtures; and
- any portal-specific code inside the workflow directory.

Then add one explicit import to `workflows/registry.js`. Dynamic third-party
code loading is intentionally out of scope until a signed plug-in design exists.

`prepare` must not change any external state. `run` must report progress, fail
closed on an unknown screen, and require review before external changes.

## Pull requests

A pull request should:

- solve one clearly described problem;
- include or update tests;
- document user-visible behavior and limitations;
- avoid unrelated formatting or dependency changes; and
- explain how it was tested without exposing live filing information.

Changes to authentication, Chrome attachment, IPC, updates, diagnostics,
submission, or payment require explicit security review.
