# Attach to an accepted Chrome session

This mode replaces the rejected Playwright-launched browser profile. Chrome is
started manually, without Playwright's automation launch configuration. After
you log in and the Income Tax portal accepts the session, the assistant attaches
to that same browser over a loopback-only Chrome DevTools connection.

## Windows setup

1. Close any previous Form 141 automation browser.
2. Open PowerShell.
3. Start a separate ordinary Chrome instance:

   ```powershell
   $chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
   $profile = "$env:LOCALAPPDATA\Form141Assistant\accepted-chrome"
   & $chrome "--remote-debugging-port=9222" "--remote-debugging-address=127.0.0.1" "--user-data-dir=$profile"
   ```

   If Chrome is installed under `Program Files (x86)`, use:

   ```powershell
   $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
   ```

4. In that Chrome window, open the Income Tax portal and log in manually.
5. Navigate to the existing Form 141 Schedule B draft and leave the relevant
   page or Add Details dialog visible.
6. In another PowerShell window, perform the read-only connection test:

   ```powershell
   npm run cli -- --probe
   ```

   This must print `Browser automation launch marker: absent` and `Attach probe
   passed`. It does not fill, click, navigate, or make an application request.
7. Only after the probe passes, run:

   ```powershell
   npm run cli -- --statement "C:\path\previous-statement.pdf" --amount 500000 --date 2026-07-29
   ```

   Or use an already reviewed candidate:

   ```powershell
   npm run cli -- --candidate "C:\path\form141-next-instalment.json"
   ```

The assistant defaults to `http://127.0.0.1:9222`. It refuses non-loopback CDP
addresses and checks that `navigator.webdriver` is not enabled before touching
the page. It does not launch or close Chrome.

## What success looks like

The terminal prints:

```text
Attached to accepted Chrome: <portal page title>
Browser automation launch marker: absent.
```

If the portal changes to Permission Denied before any field operation, save the
Network log immediately. That result means the portal objects to the debugging
attachment itself rather than Playwright's old launch profile.

## Chrome 136 and newer

Chrome requires remote debugging to use a non-default user-data directory. The
`accepted-chrome` directory above is therefore intentional. It is a normal
Chrome profile that you log into yourself; Playwright does not launch it.

Keep port 9222 bound to `127.0.0.1`. Close the dedicated Chrome window when the
run is complete.
