# Deep-link verification files

This directory holds the Digital Asset Links file that Android uses to verify
that `com.vyvent.mobile` is the legitimate owner of this site — required for
App Links auto-verification (opens shared URLs in the app without the
"Open with" chooser).

## Current state (as of 2026-04-24)

The file lives at `/orbiventt-legal/.well-known/assetlinks.json`, which is
**not** the location Android checks. Android looks for it at the HOST root:
`https://cosioyair.github.io/.well-known/assetlinks.json`. Since we don't
control the root of `cosioyair.github.io`, auto-verification cannot work
on this host.

The app currently ships with `autoVerify: false` — HTTPS share links resolve
to the 404.html landing page, which JavaScript-redirects into the app via
the `vyvent://` custom scheme. Works but shows a one-time "Open with"
chooser on some Android versions.

## Migrating to `vyvent.app`

Once the custom domain is registered:

1. **Copy this file to the host root** so it resolves at
   `https://vyvent.app/.well-known/assetlinks.json`. If the site is still
   served from this GitHub Pages repo via a custom domain CNAME, that path
   Just Works — GitHub Pages serves the file at the root because
   `vyvent.app` points at the repo directly.
2. **Replace `REPLACE_WITH_PLAY_CONSOLE_APP_SIGNING_SHA256`** with the SHA256
   from Play Console → Test and release → Setup → App integrity →
   App signing key certificate → **SHA-256**. The "upload key" SHA256 is
   already included for EAS internal-track builds.
3. **Update `app.config.js`** in the mobile repo:
   - Flip `intentFilters[].autoVerify` to `true`
   - Change `host` entries from `cosioyair.github.io` to `vyvent.app`
     (keep the github.io entries for a transition period if you want old
     share links to keep opening)
4. **Rebuild** (`eas build -p android --profile production`) and reinstall.
   Android verifies at install time; check status with
   `adb shell pm get-app-links com.vyvent.mobile` — should show
   `verified` for `vyvent.app`.

## Verify the JSON with Google's official tester

Once live, paste the full URL into
https://developers.google.com/digital-asset-links/tools/generator — should
return "success" for `com.vyvent.mobile`.
