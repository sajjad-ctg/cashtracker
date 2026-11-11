# Cash Tracker

Offline, single-file HTML5 app for tracking cash receipts (income) and expenses.
No server, no internet, no framework — and a native Android APK built with Capacitor.

| | |
|---|---|
| 🌐 Web app (PWA, installable, works offline) | **https://sajjad-ctg.github.io/cashtracker/** |
| 📦 Source | **https://github.com/sajjad-ctg/cashtracker** |
| 🤖 Android APK | [Releases](https://github.com/sajjad-ctg/cashtracker/releases) — or build it yourself (below) |

> Your data never leaves the device: everything is stored in LocalStorage, and the app
> makes no network requests at all.

---

## Features

| Area | What you get |
|---|---|
| **Entries** | Amount, date, category, *for whom* (optional), note (optional). Income and expense types. |
| **Dashboard** | Month income / expenses / net / entry count — nothing else, by design. |
| **Transactions** | Clean list: category icon, name, `date · for whom · note`, amount on the right. Tap a row to edit. Sort by date / amount / category / person. Filters for type, category, for whom, amount range, free-text search. |
| **Reports** | Period presets **Today / Daily / Weekly / Monthly / Custom range**, for **expenses**, **income** or **both**. Each report shows totals, **by category** and **for whom** breakdown cards (icon, amount, share bar, %), and the entries as a list. |
| **PDF export** | **🖨 Print** → browser print dialog → *Save as PDF*. **⬇ PDF** → one-click `.pdf` download via the bundled jsPDF + AutoTable (page numbers, running footers). |
| **Data** | JSON backup export/import, CSV export, paste-a-backup fallback, in-app confirmations. |
| **Settings** | Expense/income category lists (add, rename, recolour, emoji, delete — shown as an icon tile in the category colour), "for whom" list, theme, currency, week start, report title. |
| **Theme** | Light / Dark / System, persisted; follows `prefers-color-scheme` when set to System. |
| **Offline** | Everything is inlined — no CDN, no fonts to fetch, no network calls at all. |
| **Mobile-first** | Bottom tab bar with a raised **+** button, full-screen entry sheet, chip-grid category picker, safe-area aware, 44 px touch targets. |

**Currencies:** USD, EUR, BDT, PKR, SAR, CAD, AED, INR, JPY, CNY.
**Week starts on:** Saturday / Sunday / Monday.

### Keyboard
- `n` — new entry
- `Esc` — close dialog

---

## Mobile layout

The app switches to a phone layout at **≤ 820 px**:

| Screen | Phone behaviour |
|---|---|
| **Navigation** | Fixed bottom bar: Home · Entries · **+** (raised FAB) · Reports · Settings. The desktop top nav is hidden. |
| **Add entry** | Full-screen sheet: Amount → Date → **category chips** (tap to select, no checkmark — the selected chip is tinted) → *for whom* free-text with saved-name suggestions (labelled **Client** for income) → Note → full-width **Save expense**. |
| **Entry list** | Clean rows: coloured icon tile, category name, `date · for whom · note`, amount right-aligned (green/red). |
| **Reports** | Period presets scroll horizontally, summary cards 2-up, breakdown cards, Print hidden and PDF full-width (Android has no print engine). |
| **Filters** | Collapsed behind a **⚙ Filters** button; category / for-whom pickers open as a centred sheet with a Done button. |
| **Other** | 16 px inputs (no iOS zoom), 44 px touch targets, `env(safe-area-inset-*)` padding, orientation/resize aware, theme toggle in the top-right corner. |

Preview it on a desktop browser with `tools/mobile-preview.html` — add `?w=390&h=844` for a
phone frame or `?w=1180&h=900` for desktop.

---

## Data model

Stored under one `localStorage` key, `cashtracker.v1`:

```jsonc
{
  "version": 1,
  "settings": { "theme": "auto", "currency": "USD", "weekStart": "mon", "title": "Cash Tracker" },
  "categories": {
    "expense": [{ "id": "…", "name": "Food & Drinks", "color": "#ea580c", "emoji": "🍔" }],
    "income":  [{ "id": "…", "name": "Salary",       "color": "#16a34a", "emoji": "💼" }]
  },
  "people": [{ "id": "…", "name": "Ahmed" }],
  "txns": [
    { "id": "…", "type": "expense", "amountCents": 1250, "date": "2026-11-02",
      "categoryId": "…", "personId": "…", "note": "Lunch", "createdAt": 1762080000000 }
  ]
}
```

Amounts are stored as **integer minor units (cents)** so no floating-point drift creeps into totals.
A `version` field allows schema migrations later.

---

## Project layout

```
cashtracker/
  build.mjs               inlines CSS + app + jsPDF into one offline HTML file
  server.mjs              tiny static server, for local testing
  capacitor.config.json   appId com.mskctg.cashtracker, webDir www
  src/
    index.html            app shell + placeholders
    styles.css            design tokens, light/dark theme, mobile layout, print stylesheet
    app.js                store, router, views, reports, PDF, import/export
    pwa/                  manifest.webmanifest + service worker (web version)
  tools/
    setup-toolchain.mjs   installs JDK 21 + Android SDK into tools/
    build-apk.mjs         builds dist/cashtracker.apk
    build-release.mjs     builds the signed APK + AAB
    make-keystore.mjs     creates the release upload key
    make-icons.mjs        renders the launcher icon, splash and PWA icons
    mobile-preview.html   renders the app in a phone frame
  android/                Capacitor's native project
    app/src/main/java/com/mskctg/cashtracker/
      MainActivity.java   registers the SaveFile plugin
      SaveFilePlugin.java writes PDF / CSV / JSON into the device's Downloads
  .github/workflows/
    apk.yml               debug APK on push, artefacts attached on a v* tag
    pages.yml             deploys the web app to GitHub Pages
```

---

## Building the web app

```bash
npm install
npm run build        # → dist/cashtracker.html  (one self-contained file)
npm run serve        # → http://localhost:4173
```

`build.mjs` inlines `src/styles.css`, `src/app.js`, `jspdf.umd.min.js` and
`jspdf-autotable.min.js` into `src/index.html` and writes the single file.

---

## Android APK (Capacitor)

The web app is packaged as a native Android app with [Capacitor](https://capacitorjs.com).
**The toolchain is project-local** — nothing is installed system-wide, so housekeeping is
`rm -rf tools`.

### Build it

```bash
npm install
node tools/setup-toolchain.mjs   # first time only: JDK 21 + Android SDK (~890 MB)
npm run apk                      # → dist/cashtracker.apk
adb install -r dist/cashtracker.apk
```

`npm run apk` = build the web app → `cap sync android` → `gradlew assembleDebug` → collect the APK.
Everything it downloads (Gradle, Maven deps) lands in `tools/gradle-home`.

**Current build:** `com.mskctg.cashtracker` · versionCode 1 · minSdk 24 · targetSdk 36 · ~4.7 MB.

**Space used (all removable):**

| Folder | Size | |
|---|---|---|
| `tools/jdk-21.*` | 328 MB | portable JDK |
| `tools/android-sdk` | 564 MB | platform 36 + build-tools |
| `tools/gradle-home` | 938 MB | Gradle + Maven cache |
| `node_modules` | 87 MB | npm packages |

`rm -rf tools node_modules` reclaims ~1.9 GB; `node tools/setup-toolchain.mjs` puts it back.

### What the native layer adds

| Web app feature | Native support |
|---|---|
| Export PDF / CSV / JSON | `SaveFilePlugin` writes the bytes into **Downloads** (MediaStore on Android 10+, legacy path below) and shows a toast |
| Import backup | Capacitor's bridge implements the file picker |
| LocalStorage | served from a real `https://localhost` origin → reliable |
| Launcher icon & splash | rendered from `src/cashtracker_icon.png` (`npm run icons`) |
| Offline | all assets bundled in the APK |

The web app talks to the plugin through the `AndroidBridge.saveFile(name, mime, base64)`
contract, so **the HTML needs no changes** — a small shim in `src/index.html` maps
Capacitor's plugin API onto that name and waits for the plugin to be available.

### Check it on the phone

1. Install the APK (allow "install unknown apps" when prompted).
2. **Settings → Data** → *Export backup* should drop a `.json` into **Downloads**.
3. **Reports → ⬇ PDF** → the report appears in **Downloads**.
4. **Settings → ⬆ Import backup** → the system file picker opens; pick a previously exported `.json**.

**Print on Android:** the WebView has no print engine, so the Print button is hidden on
phones and the PDF is the way out — open it from Downloads and print from there.

---

## Publishing to Google Play (signed APK + AAB)

### 1. One-time: create the upload key

```bash
npm run keystore
```

This runs `keytool` from `tools/jdk-21` and writes:

| File | Purpose |
|---|---|
| `android/keystore/cashtracker-release.jks` | your **upload key** — back it up somewhere safe |
| `android/keystore.properties` | the passwords, read by Gradle (git-ignored) |

> ⚠️ **Back up the `.jks` and its password.** If you lose them you can never publish an
> update to this app again — the only way out is asking Google to reset your upload key.

To use your own key instead, create it anywhere and point `android/keystore.properties` at it:

```properties
storeFile=keystore/cashtracker-release.jks   # relative to android/
storePassword=••••••
keyAlias=cashtracker
keyPassword=••••••
```

### 2. Build the signed artefacts

```bash
npm run release -- --versionCode 1 --versionName 1.0.0
```

Output:

```
dist/cashtracker-release.apk   signed, for direct install
dist/cashtracker-release.aab   signed, for Google Play
```

* `versionCode` **must increase** with every upload — Play rejects duplicates.
* The APK is signed with your key (v2 scheme). Play re-signs the app with its own
  **app signing key**, so your upload key never ships to users.

### 3. Verify before uploading

```bash
tools/android-sdk/build-tools/36.0.0/apksigner.bat verify --print-certs dist/cashtracker-release.apk
tools/android-sdk/build-tools/36.0.0/aapt2.exe dump badging dist/cashtracker-release.apk
```

Expect `Signer #1 certificate DN: CN=Cash Tracker, OU=MSKCTG` and `targetSdkVersion:'36'`.

### 4. Play Console

1. **play.google.com/console** → developer account → **Create app**.
2. Store listing: name, descriptions, screenshots (phone + 7" tablet), feature graphic
   (1024×500) and the 512×512 icon — `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`.
3. **Privacy policy** — required. The app collects nothing, so a one-line public page is fine.
4. **App content** → content rating, target audience, and declare **no data collected / not shared**.
5. **Release → Internal testing → Create new release** → upload `dist/cashtracker-release.aab`.
6. Test from the Play link on your phone, then promote to production.

### 5. Google Play requirements this build already satisfies

| Requirement | Status |
|---|---|
| Target API level | **36** (required since Aug 2026 for new apps and updates) |
| 64-bit | yes (Capacitor ships `arm64-v8a`, `armeabi-v7a`, `x86_64`) |
| App bundle | yes — you upload the `.aab` |
| Signed | yes — upload key + Play App Signing |
| Privacy | no data collected, nothing leaves the device |

### 6. Later updates

```bash
npm run release -- --versionCode 2 --versionName 1.1.0
# upload the new .aab to Play Console → Production → Create new release
```

Keep `versionCode` strictly increasing.

---

## Keeping it on GitHub

The repository is source-only: **no build output, no toolchain, no signing keys**.

| What | Where it lives |
|---|---|
| Source, workflows, docs | the git repo |
| `cashtracker.html`, the APK/AAB | **GitHub Releases** (attached by the workflow) |
| The upload keystore + passwords | your password manager / encrypted drive — **never** in git |

`.gitignore` excludes `android/keystore/`, `android/keystore.properties`,
`Output Playstore/`, `tools/` (the 1.9 GB toolchain), `node_modules/`,
`dist/`, `www/` and `site/`.

### Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `apk.yml` | every push to `main` | builds the **debug** APK (no secrets needed) and uploads it as a workflow artefact |
| `apk.yml` | tag `v1.2.3` | attaches the debug APK **and** `cashtracker.html` to a GitHub Release |
| `pages.yml` | every push to `main` | builds the web app and deploys it to **GitHub Pages** (PWA: installable + offline) |

### Publishing a release

Run these as **separate commands** (Windows PowerShell 5.1 has no `&&`):

```powershell
npm run release -- --versionCode 2 --versionName 1.1.0   # signed APK + AAB (local)
git tag -a v1.1.0 -m "Cash Tracker v1.1.0"
git push origin main --tags                                # CI attaches the debug APK + HTML
```

> In PowerShell 7+ you can chain them with `&&`. In PowerShell 5.1 (Windows default) `&&`
> is a syntax error — run the lines one at a time.

Then upload `dist/cashtracker-release.aab` to the Play Console.

### Notes

- **CI does not sign releases.** The upload key would have to live in GitHub Secrets,
  and a leaked secret means someone can push an update to your app. Build the signed
  artefact locally instead.
- The Pages build and the APK keep **separate data** (`localStorage` is per-origin).
  Use the JSON backup export to move data between them.
- Pages is enabled with the *GitHub Actions* source; the site is
  **https://sajjad-ctg.github.io/cashtracker/**.

---

## Running inside a plain Android WebView (no Capacitor)

If you ever wrap the HTML in a bare WebView instead of Capacitor, the app still works —
it just uses its built-in fallbacks. A plain `WebView` does **not** implement
`window.print()`, `<a download>` blob saves, `confirm()`/`prompt()` or the file picker,
so the app avoids all of them:

| Feature | Behaviour in a bare WebView | How to get real output |
|---|---|---|
| Delete / Clear all data | In‑app confirmation dialog (no native `confirm()`) | ✅ works everywhere |
| CSV / JSON export | Shows an **export sheet** with **⬇ Download** *and* **📋 Copy** | Copy → paste into any file app; or add a bridge |
| Print | Shows the **Print report** sheet with a **⬇ PDF** button instead of a dead `window.print()` | Save the PDF and print it from a viewer |
| Import backup | File picker **or** the built‑in **⌨ Paste a backup instead** box | ✅ works everywhere |
| Storage | LocalStorage works in a WebView | ✅ |

### Optional: give the app a native bridge

If your wrapper can inject a JavaScript object, expose a method named `saveFile`, `save`,
`download`, `downloadFile` or `writeFile`. The app calls it automatically and skips the
export sheet:

```javascript
AndroidBridge.saveFile(filename, mimeType, base64Payload)
```

The app looks for `window.AndroidBridge`, `window.Android`, `window.AndroidFile`,
`window.NativeApp`, `window.WebAppBridge`, `window.Ebridge` or `window.JsBridge`.

---

## Implementation notes

- **Plugin registration order** — the plugin is registered in `MainActivity.onCreate()`
  **before** `super.onCreate()`. Capacitor builds its Bridge inside `super.onCreate()`,
  so a plugin registered afterwards is silently ignored.
- **Bridge timing** — Capacitor injects its JS bridge asynchronously; the shim waits for
  `Capacitor.isPluginAvailable('AndroidBridge')` before exposing `window.AndroidBridge`.
- **Status bar / notch** — Capacitor 8 runs edge-to-edge and injects
  `--safe-area-inset-top/-bottom/-left/-right` into `<html>`. The stylesheet reads them
  (falling back to `env(safe-area-inset-*)` for iOS/browsers) and pads the top bar and
  the bottom tab bar accordingly.
- **Splash** — the launch theme uses the Android 12+ splash-screen API
  (`windowSplashScreenBackground` + `windowSplashScreenAnimatedIcon`), because that API
  ignores `android:background` — without it you get a black screen.
- **Icon** — the launcher icon and splash are rendered from `src/cashtracker_icon.png`
  by `npm run icons`. The adaptive icon uses a black background layer plus the coin as
  the foreground (60 % of the 108 dp canvas, inside the 66 dp safe zone) and a
  monochrome layer for themed icons.
- **API level** — `compileSdkVersion` and `targetSdkVersion` are pinned to **36** in
  `android/variables.gradle`, and `npm run apk` refuses to build if either changes.
