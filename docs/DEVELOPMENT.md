# Developer guide

[← Project overview](../README.md)

## Development

Built with **React 19, TypeScript, Vite, Tailwind CSS, Express and WebSocket**. Requires **Node.js 22.12 or later**.

```bash
npm ci
npm run dev
```

The terminal prints the local and LAN addresses with the selected port. Open the local address for the landing page, or append `?app=network` to open the full local application. QR links containing `?pin=...` open the participant screen directly.

By default, `PORT=0` selects an available port at each launch. For a fixed port:

```bash
PORT=4444 npm run dev
```

The server also reads `PORT` from an optional `.env` file; see [.env.example](../.env.example). No API credentials are needed.

### Checks and production build

```bash
npm run lint
npm test
npm run build
```

To serve the built application with the multiplayer server:

```bash
NODE_ENV=production npm start
```

`npm run preview` serves the frontend only. Network quizzes require `npm start` or `npm run dev`.

Multiplayer sessions are held in server memory and disappear when the server restarts. The current server does not authenticate presenter and player roles; it is intended for trusted local networks. Public Internet multiplayer hosting requires additional access controls and request validation.

## Browser storage and portability

Quizzes, embedded images and uploaded videos are stored locally in **IndexedDB**, with migration support for quizzes previously stored in `localStorage`. Uploaded videos are stored as blobs. Uploaded images can be up to 15 MB and are resized to a maximum of 1600 pixels on the longest side.

For browser-based use, storage belongs to the full origin, **including the port**. Changing the port, browser or computer gives you a different quiz library; data at the previous origin is not automatically moved. Use a fixed port for a stable local library, or export and import quizzes as JSON.

Exported JSON includes uploaded video data and may be large. Export backups before clearing site data or moving to another device. If saving fails, the editor stays open so you can export your quiz.

Online images, Commons searches and YouTube/Vimeo playback need Internet access. Embedded images and uploaded video files remain available locally.

## GitHub Pages

The public site is **[napo.github.io/qurioso](https://napo.github.io/qurioso/)**.

The entire landing page is available in **[Italian](https://napo.github.io/qurioso/?lang=it)**, **[English](https://napo.github.io/qurioso/?lang=en)** and **[German](https://napo.github.io/qurioso/?lang=de)**. Use the language selector in the header. The selected language is remembered in the browser and passed to the classroom application. A `lang` URL parameter overrides the saved preference; otherwise, Qurioso uses the saved preference, a supported browser language, or Italian as the fallback. Translation strings are in `src/i18n/landing.ts`.

The landing page offers two entry points:

- `?app=classroom` opens the browser-only classroom library, without multiplayer connections, PIN controls or installation prompts.
- `#quiz-in-rete` opens the network quiz download section and LAN instructions.

The [Pages workflow](../.github/workflows/pages.yml) runs checks, builds `dist` and deploys it on pushes to `main`, or when started manually. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Relative asset paths support deployment under `/qurioso/`.

Download links prefer a stable GitHub Release containing desktop installers. If none is available, the latest available prerelease with desktop installers is offered and explicitly labeled as a preview build. Only published Windows (`.exe`, `.msi`), macOS (`.dmg`, `.pkg`) and Linux (`.AppImage`, `.deb`, `.rpm`) installers are displayed. Source archives and CI artifacts are not presented as installers. When an installer is missing, the page says so.

The separate [multiplatform workflow](../.github/workflows/build-multiplatform.yml) contains desktop, web and experimental Android build jobs. The Android wrapper does not include the Node.js multiplayer backend. The Electron desktop configuration includes that server and does not require users to install Node.js.

## Logo and social preview

The visual identity uses a **white background**, **petrolio `#075E63`** and **mandarino `#FF963B`**, with lighter tints for secondary surfaces. Shared theme tokens are in [src/index.css](../src/index.css).

- [Original logo](../public/logo.svg): the supplied Qurioso wordmark.
- [Logo on white](../public/logo-on-white.png): the same logo on an opaque white background, used above so its colors remain consistent in light and dark GitHub themes.
- [Q icon](../public/icon.svg): extracted from the original paths, preserving the face and orange tail.
- `public/icon-192.png`, `public/icon-512.png` and `public/apple-touch-icon.png`: application and home-screen icons.
- [Social preview PNG](../public/social-preview.png): a 1280 × 640 image for shared links, with an opaque white background.
- [Editable social preview SVG](../public/social-preview.svg): includes the original logo paths.

The website declares Open Graph and Twitter Card metadata using the public PNG URL. For the **repository’s** social preview, upload the same PNG in **[Repository settings](https://github.com/napo/qurioso/settings) → Social preview → Edit → Upload an image**. GitHub manages this image separately from the website’s metadata.

To regenerate the PNG after editing the SVG, using Inkscape:

```bash
inkscape public/social-preview.svg --export-type=png --export-filename=public/social-preview.png --export-width=1280 --export-height=640
```

## Android build workflow

The [Desktop, Web and Android Builds workflow](../.github/workflows/build-multiplatform.yml) builds the web app and an experimental debug APK. It also builds Electron desktop installers on native Windows, macOS and Linux runners.

Capacitor core, Android and CLI are pinned to the same version in `package.json` and `package-lock.json`, and installed with `npm ci`. The workflow uses Node.js 22 and Java 21. Android SDK setup installs `platform-tools`, without the retired `tools` package. The Gradle build resolves the platform and build tools required by the generated Capacitor project.

To prepare a local Android project after installing the development dependencies:

```bash
npm run build
npx --no-install cap add android
npx --no-install cap sync android
```

Run `cap add` only when the `android` directory does not exist. With Java 21 and the Android SDK configured, build the debug APK from that directory:

```bash
cd android
./gradlew --no-daemon assembleDebug
```

Pushes to `main` and pull requests upload the web files and debug APK as Actions artifacts. Pushing a `v*` tag also creates a GitHub Release with a web ZIP and the Android debug APK attached. Tags containing a hyphen, such as `v1.0.0-beta.1`, create prereleases. The Android wrapper and web ZIP do not include the Node.js multiplayer server; desktop installers are included after all native builds succeed.

To publish a version after committing the desired changes:

```bash
git tag -a v1.0.0-beta.1 -m "Qurioso 1.0.0 beta 1"
git push origin main
git push origin v1.0.0-beta.1
```

Use a new tag for each release. The release job runs only after all builds succeed.

## Desktop installers (Electron)

```bash
npm ci
npm run desktop:dev
npm run desktop:build
```

`desktop:dev` builds and opens the desktop app. `desktop:build` creates installers for the current operating system in `release-desktop/`. To create an unpacked application for testing, use `npm run desktop:pack`.

The desktop workflow produces Windows x64 NSIS `.exe` installers, macOS Intel and Apple Silicon `.dmg` images, and Linux x64 `.AppImage` and `.deb` packages. A `v*` tag publishes these files alongside the web ZIP and Android APK. Use a new version tag, such as `v1.0.0-beta.2`, after committing these changes; existing tags keep their original builds.

Electron launches the bundled production server in a utility process, listening on an available LAN port. Closing the application stops the server. The renderer has Node integration disabled, context isolation enabled and sandboxing enabled. External links open in the system browser.

The desktop window uses the fixed internal origin `http://qurioso.localhost` through Electron’s HTTP protocol handler. Requests go to the current local server, while WebSocket connections use the actual free port. This preserves IndexedDB between launches without fixing the LAN port. QR codes advertise the actual LAN address and port. This internal hostname is used only inside the desktop application; students use the LAN URL.

The application data is stored under Electron’s per-user Qurioso profile. Browser-only and desktop quiz libraries are separate: use JSON export/import to transfer quizzes.

To verify startup, the rendered application, host session creation, WebSocket access, persistent IndexedDB across changing ports, and shutdown:

```bash
npm run desktop:prepare
npm run desktop:smoke
# Or test the generated Linux application:
node scripts/test-desktop.mjs release-desktop/linux-unpacked/qurioso
```

The smoke check uses a temporary profile and does not alter the user’s quiz library. Linux CI runs it against the packaged application. Windows and macOS packages are built on native runners; their installers still need user acceptance testing on those platforms.

The initial packages are unsigned, and macOS packages are not notarized. No automatic updater is configured. The branding uses the original Q icon.
