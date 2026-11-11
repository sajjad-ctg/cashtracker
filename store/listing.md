# Google Play listing — Cash Tracker

Everything you need to paste into the Play Console. Assets are in `store/`.

---

## 1. App details

| Field | Value |
|---|---|
| App name (30 chars max) | `Cash Tracker` |
| Short description (80 chars max) | `Offline cash & expense tracker. Track daily income and spending, export PDF reports.` |
| Language | English (United States) |
| App or game | App |
| Category | Finance |
| Tags | Budget, Expense tracker, Money |
| Contact email | *(your address)* |
| Privacy policy URL | `https://sajjad-ctg.github.io/cashtracker/privacy.html` |

## 2. Graphics

| Asset | File | Size |
|---|---|---|
| App icon (512×512 PNG, 32-bit) | `store/icon-512.png` | 512×512 |
| Feature graphic (1024×500 PNG/JPEG) | `store/feature-graphic-1024x500.png` | 1024×500 |
| Phone screenshot 1 | `store/screenshots/01-dashboard.png` | 720×1280 (9:16) |
| Phone screenshot 2 | `store/screenshots/02-transactions.png` | 720×1280 |
| Phone screenshot 3 | `store/screenshots/03-reports.png` | 720×1280 |
| Phone screenshot 4 | `store/screenshots/04-add-entry.png` | 720×1280 |
| Phone screenshot 5 | `store/screenshots/05-settings.png` | 720×1280 |

Upload at least 2 phone screenshots; all five are provided. A 7" tablet screenshot is
optional — the same PNGs work.

## 3. Full description (4000 chars max)

```
Cash Tracker is a fast, private money tracker that works completely offline.

• Track income and expenses in seconds
  Add an amount, pick a category, and you're done. Tap any entry to edit or delete it.

• See where your money goes
  The dashboard shows this month's income, expenses and net balance at a glance.

• Reports for any period
  Today, a single day, a week, a month or a custom date range. Every report breaks the
  numbers down by category and by person, with share bars for the biggest items.

• Export anywhere
  Save a polished PDF report, export a CSV for spreadsheets, or back up everything to a
  JSON file you control.

• Your own categories
  Rename, recolour and add your own income and expense categories, plus a list of the
  people and things you spend on (family, home, a client, and so on).

• Fully offline, by design
  No account, no sign-in, no ads, no analytics and no tracking. Your entries are stored
  only on your device, so your financial data never leaves your phone. Nothing is
  collected, nothing is shared.

• Built for your phone
  A clean bottom navigation bar, a big tap-friendly entry sheet, a category picker you
  can use with one thumb, and a light/dark theme that follows your system.

Cash Tracker is free, has no ads and makes no network requests. Back up regularly using
the JSON export in Settings.
```

## 4. Release notes (500 chars max) — first release

```
First release.

• Track income and expenses with categories, people and notes
• Dashboard with monthly income, expenses and net balance
• Reports for today, a day, a week, a month or a custom range
• Breakdowns by category and by person
• PDF, CSV and JSON export, plus backup import
• Light and dark themes, fully offline, no ads, no tracking
```

## 5. Data safety

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | N/A — no data is transmitted |
| Do you provide a way for users to request that their data is deleted? | Yes — Settings → Data → Clear all data (and uninstalling removes it) |
| Data types collected | **None** |

The app has no analytics, no ads and no crash reporting. It makes no network requests.

## 6. App content

| Section | Answer |
|---|---|
| Privacy policy | `https://sajjad-ctg.github.io/cashtracker/privacy.html` |
| Ads | No ads |
| Target audience | 18+ (finance/budgeting tool; content is suitable for everyone) |
| Content rating questionnaire | Utility/Productivity app — no violence, sexuality, language, gambling, user interaction or location sharing. Rating: PEGI 3 / Everyone |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | See section 5 |
| Government apps | No |
| Financial features | The app does **not** lend money, trade securities, send money, or offer financial advice. It only records entries the user creates themselves. |
| Health | No |
| Permissions | `WRITE_EXTERNAL_STORAGE` (maxSdkVersion 28) — writes the user's own exported files to Downloads. `INTERNET` — declared by the Capacitor framework, never used by the app. |

## 7. Release

1. **Upload** `dist/cashtracker-release.aab` (Release → Testing → Create new release).
2. Roll out to **Internal testing** first and install from the Play link.
3. New personal developer accounts need a **closed test with 12 testers for 14 days**
   before production is possible.
4. When you publish a new version: `npm run release -- --versionCode 2 --versionName 1.1.0`
   and upload the new `.aab`. The versionCode must always increase.

## 8. Regenerating the assets

```powershell
node tools/make-icons.mjs          # launcher icon + splash from src/cashtracker_icon.png
node tools/make-store-assets.mjs    # feature graphic + Play icon (screenshots come from the browser capture)
```
