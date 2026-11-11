---

## Publishing to Google Play (signed APK + AAB)

Everything below runs with the **project-local** toolchain — no Android Studio needed.

### 1. One-time: create the upload key

```bash
npm run keystore
```

This runs `keytool` from `tools/jdk-21` and writes:

| File | Purpose |
|---|---|
| `android/keystore/cashtracker-release.jks` | your **upload key** — back it up somewhere safe |
| `android/keystore.properties` | the passwords, read by Gradle (git-ignored) |

> ⚠️ **Back up the `.jks` and its password right now** (password manager + cloud drive).
> If you lose them you can never publish an update to this app again — the only way
> out is asking Google to reset your upload key.

To use your own key instead, create it anywhere and point `android/keystore.properties`
at it:

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

Output (verified):

```
dist/cashtracker-release.apk   3.59 MB   signed, for direct install
dist/cashtracker-release.aab   3.43 MB   signed, for Google Play
```

* `versionCode` **must increase** with every upload — Play rejects duplicates.
  It is an integer (1, 2, 3 …); `versionName` is the user-visible one (`1.0.0`).
* The APK is signed with your key (v2 signature scheme). Play re-signs the app
  with its own **app signing key**, so your upload key never ships to users.

### 3. Verify before uploading

```bash
tools/android-sdk/build-tools/36.0.0/apksigner.bat verify --print-certs dist/cashtracker-release.apk
tools/android-sdk/build-tools/36.0.0/aapt2.exe dump badging dist/cashtracker-release.apk
```

Expect `Signer #1 certificate DN: CN=Cash Tracker, OU=MSKCTG` and
`targetSdkVersion:'36'`.

### 4. Play Console

1. **play.google.com/console** → create a developer account (one-off $25) → **Create app**.
2. Fill in the store listing: app name, short description, full description,
   screenshots (phone + 7" tablet), feature graphic (1024×500), and an **icon**
   (512×512 PNG — use `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`).
3. **Privacy policy** — required. The app collects nothing, so a one-line page is fine,
   but the URL must be public.
4. **App content** → set the content rating questionnaire, target audience,
   and declare **no data collected / no data shared** (accurate for this app).
5. **Pricing** → free.
6. **Release → Testing → Create new release** → upload `dist/cashtracker-release.aab`.
7. Roll out to **internal testing** first, install from the Play link on your phone,
   test the save/export flow, then promote to production.

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

Keep `versionCode` strictly increasing. If the app's content changes (new
categories, a new report type), bump `versionName` too.

### Manual Gradle commands (if you prefer)

```bash
cd android
..\tools\jdk-21.0.13+9\bin\java -version          # sanity check
gradlew.bat assembleRelease                        # → app/build/outputs/apk/release/app-release.apk
gradlew.bat bundleRelease                          # → app/build/outputs/bundle/release/app-release.aab
```

`JAVA_HOME`, `ANDROID_HOME` and `GRADLE_USER_HOME` must point into `tools/` —
`tools/build-release.mjs` sets all of them for you.
