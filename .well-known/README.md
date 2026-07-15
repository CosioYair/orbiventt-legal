# Deep-link verification files

This directory holds the Digital Asset Links file that Android uses to verify
that `com.vyvent.mobile` is the legitimate owner of this site — required for
App Links auto-verification (opens shared URLs in the app without the
"Open with" chooser).

## Current state (updated 2026-07 — custom domain live)

The site is now served from the root of the custom domain, so the file
resolves at `https://orbiventt.com/.well-known/assetlinks.json` — which
**is** a location Android can check (host root). While the site was a
GitHub project page (`cosioyair.github.io/orbiventt-legal/`), the file sat
under the repo subpath and auto-verification could not work; that
limitation no longer applies.

The app currently still ships with `autoVerify: false` — HTTPS share links
resolve to the 404.html landing page, which JavaScript-redirects into the
app via the `vyvent://` custom scheme. Works but shows a one-time
"Open with" chooser on some Android versions.

## Enabling App Links auto-verification on `orbiventt.com`

Now that the custom domain is live:

1. **Nothing to move** — GitHub Pages already serves this file at
   `https://orbiventt.com/.well-known/assetlinks.json` because the CNAME
   points the domain at the repo root.
2. **Replace `REPLACE_WITH_PLAY_CONSOLE_APP_SIGNING_SHA256`** with the SHA256
   from Play Console → Test and release → Setup → App integrity →
   App signing key certificate → **SHA-256**. The "upload key" SHA256 is
   already included for EAS internal-track builds.
3. **Update `app.config.js`** in the mobile repo:
   - Flip `intentFilters[].autoVerify` to `true`
   - Change `host` entries from `cosioyair.github.io` to `orbiventt.com`
     (keep the github.io entries for a transition period if you want old
     share links to keep opening)
4. **Rebuild** (`eas build -p android --profile production`) and reinstall.
   Android verifies at install time; check status with
   `adb shell pm get-app-links com.vyvent.mobile` — should show
   `verified` for `orbiventt.com`.

## Verify the JSON with Google's official tester

Once live, paste the full URL into
https://developers.google.com/digital-asset-links/tools/generator — should
return "success" for `com.vyvent.mobile`.
