# Advanced: attach to ordinary Chrome manually

The desktop application normally performs this setup. These instructions are
for CLI debugging.

## Windows

Close any previous DeBabufy Chrome window, then use PowerShell:

```powershell
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome was not found." }
$profile = "$env:LOCALAPPDATA\DeBabufy\chrome-profile"
& $chrome "--remote-debugging-port=9222" "--remote-debugging-address=127.0.0.1" "--user-data-dir=$profile"
```

Log in manually and open the Form 141 Schedule B page. From the repository:

```powershell
npm run cli:form141 -- --probe
```

For a guided CLI run:

```powershell
npm run cli:form141 -- --statement "C:\path\previous-statement.pdf" --amount 500000
```

Chrome 136 and newer require remote debugging to use a non-default user-data
directory. Keep the debugging address on `127.0.0.1`, never expose it to a
network, and never share the dedicated Chrome profile.
