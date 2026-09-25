# Privacy

DeBabufy is local-first.

## Data handled

The selected workflow may process a previous challan statement, names, PANs,
contact details, property details, tax figures, and the rendered portal page.

## Where it goes

- Statement contents and proposals remain in application memory.
- DeBabufy does not operate a backend and does not collect telemetry.
- A dedicated Chrome profile is stored in DeBabufy's local application-data
  directory so the user can log in normally.
- Failure diagnostics are stored locally in the application's `diagnostics`
  directory.
- DeBabufy makes a short request to GitHub's public releases API at startup to
  check whether a newer platform package exists. The request contains
  the installed application version and normal network metadata, but no
  statement, portal, taxpayer, property, or filing data. A failed or offline
  update check is ignored.

The government portal itself receives data when the user runs a workflow in
their authenticated Chrome session, just as it would during manual entry.

## Sharing

Never share the Chrome profile. Review and redact diagnostics before attaching
them to a public issue. When in doubt, describe the screen and error without
uploading the file.

Uninstalling DeBabufy may not delete its application-data directory
automatically. Users can remove that directory to delete the dedicated Chrome
profile and diagnostics after closing DeBabufy and Chrome.
