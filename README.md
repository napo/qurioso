<p align="center">
  <a href="https://napo.github.io/qurioso/">
    <img src="public/logo-on-white.png" alt="Qurioso" width="460" />
  </a>
</p>

<p align="center"><strong>Bring curiosity into the classroom.</strong></p>
<p align="center">Create quizzes with images and videos. Discuss answers together, or let everyone join from their own device on the same local network.</p>
<p align="center">
  <a href="https://napo.github.io/qurioso/">Explore Qurioso</a> ·
  <a href="https://napo.github.io/qurioso/?app=classroom">Open classroom activities</a> ·
  <a href="https://napo.github.io/qurioso/#quiz-in-rete">Network quizzes and downloads</a>
</p>

## Two ways to use Qurioso

| | Classroom activities — “Attività in classe” | Network quizzes — “Quiz in Rete” |
| --- | --- | --- |
| How it works | The teacher displays the questions, listens to the class and selects the collective answer. | Each student answers individually from their own device using a QR code and game PIN. |
| Devices | One shared device, optionally connected to a projector. | The teacher’s computer and the students’ phones, tablets or computers. |
| Installation | Open the website in a browser. No installation required. | Run Qurioso’s local server on the teacher’s computer. Students only need a browser. |
| Network | No connection between student devices is needed. Online videos and image searches require Internet access. | **All devices must be on the same local network (LAN or Wi-Fi)** and be allowed to communicate with each other. |
| Questions | With or without video; no automatic time limit for collective answers. | Timed rounds, individual feedback, scores and leaderboards. |

**[Start a classroom activity →](https://napo.github.io/qurioso/?app=classroom)**

Desktop installers for Windows, macOS and Linux are **not available yet**. The website displays installers from the latest stable [GitHub Release](https://github.com/napo/qurioso/releases) when they are published. Until then, running a network quiz requires the development setup below. Publishing the website does not build desktop installers.

## Features

- Create multiple-choice questions with up to six options, or true/false questions.
- Add cover and question images using a URL, local JPG/PNG/WebP files or Wikimedia Commons search. Commons selections retain author, license and source credits.
- Use a local MP4/WebM file, a direct video URL, YouTube or Vimeo. Videos pause at question checkpoints and resume after the answer and feedback.
- Search YouTube or Vimeo in a new browser tab, then paste the chosen video link into Qurioso. No API keys or account connection to Qurioso are required.
- Save quizzes in the browser and import or export them as JSON, including embedded images and uploaded videos.
- In network quizzes, show answer distributions and final statistics, export results as CSV or JSON, and use test bots to try a session.
- Switch between Italian, English and German. Some recently added interface text is currently in Italian.
- Use the original white, petrolio and mandarino visual identity throughout the interface.

## Classroom activities

1. Open [Qurioso in your browser](https://napo.github.io/qurioso/?app=classroom).
2. Pick an example quiz, import a JSON quiz, or create your own.
3. Choose **Attività in classe** on the quiz card.
4. Display the questions and select the answer agreed on by the class.

Students do not need to join from their phones. This mode collects a **collective answer**, rather than individual student submissions. Standard quizzes show a final summary of the class’s answers.

For a video quiz, choose **Crea quiz video** or select **Quiz con video** at the top of the editor. Choose a source, set each question’s checkpoint in seconds and save. During a classroom activity, the video pauses at the checkpoints and questions stay open while the class discusses them.

YouTube and Vimeo require Internet access and videos that allow embedded playback. Platform or owner restrictions may prevent playback. Qurioso does not download videos from these platforms.

## Network quizzes

Qurioso runs an HTTP and WebSocket server on the teacher’s computer. Participants join using the LAN address, QR code and PIN shown by the presenter.

- Connect the teacher’s computer and all participant devices to the **same LAN or Wi-Fi network**.
- Allow connections to Qurioso’s listening port through the teacher’s firewall.
- Guest networks and some school networks isolate clients; ask the network administrator if devices cannot reach each other.
- A randomly selected port avoids port conflicts. It does not make the teacher’s computer accessible from the Internet.

Installing the website as a PWA or wrapping it with Capacitor does not provide the local multiplayer server. Desktop packaging with an included server is still to be implemented.

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

The server also reads `PORT` from an optional `.env` file; see [.env.example](.env.example). No API credentials are needed.

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

Browser storage belongs to the full origin, **including the port**. Changing the port, browser or computer gives you a different quiz library; data at the previous origin is not automatically moved. Use a fixed port for a stable local library, or export and import quizzes as JSON.

Exported JSON includes uploaded video data and may be large. Export backups before clearing site data or moving to another device. If saving fails, the editor stays open so you can export your quiz.

Online images, Commons searches and YouTube/Vimeo playback need Internet access. Embedded images and uploaded video files remain available locally.

## GitHub Pages

The public site is **[napo.github.io/qurioso](https://napo.github.io/qurioso/)**.

The entire landing page is available in **[Italian](https://napo.github.io/qurioso/?lang=it)**, **[English](https://napo.github.io/qurioso/?lang=en)** and **[German](https://napo.github.io/qurioso/?lang=de)**. Use the language selector in the header. The selected language is remembered in the browser and passed to the classroom application. A `lang` URL parameter overrides the saved preference; otherwise, Qurioso uses the saved preference, a supported browser language, or Italian as the fallback. Translation strings are in `src/i18n/landing.ts`.

The landing page offers two entry points:

- `?app=classroom` opens the browser-only classroom library, without multiplayer connections, PIN controls or installation prompts.
- `#quiz-in-rete` opens the network quiz download section and LAN instructions.

The [Pages workflow](.github/workflows/pages.yml) runs checks, builds `dist` and deploys it on pushes to `main`, or when started manually. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Relative asset paths support deployment under `/qurioso/`.

Download links are read from the latest stable GitHub Release. Only published Windows (`.exe`, `.msi`), macOS (`.dmg`, `.pkg`) and Linux (`.AppImage`, `.deb`, `.rpm`) installers are displayed. Source archives and CI artifacts are not presented as installers. When an installer is missing, the page says so.

The separate [multiplatform workflow](.github/workflows/build-multiplatform.yml) contains web and experimental Android build jobs. The repository includes a Capacitor configuration, but Android packaging does not include the Node.js multiplayer backend. There is currently no Electron entry point or desktop installer configuration.

## Logo and social preview

The visual identity uses a **white background**, **petrolio `#075E63`** and **mandarino `#FF963B`**, with lighter tints for secondary surfaces. Shared theme tokens are in [src/index.css](src/index.css).

- [Original logo](public/logo.svg): the supplied Qurioso wordmark.
- [Logo on white](public/logo-on-white.png): the same logo on an opaque white background, used above so its colors remain consistent in light and dark GitHub themes.
- [Q icon](public/icon.svg): extracted from the original paths, preserving the face and orange tail.
- `public/icon-192.png`, `public/icon-512.png` and `public/apple-touch-icon.png`: application and home-screen icons.
- [Social preview PNG](public/social-preview.png): a 1280 × 640 image for shared links, with an opaque white background.
- [Editable social preview SVG](public/social-preview.svg): includes the original logo paths.

The website declares Open Graph and Twitter Card metadata using the public PNG URL. For the **repository’s** social preview, upload the same PNG in **[Repository settings](https://github.com/napo/qurioso/settings) → Social preview → Edit → Upload an image**. GitHub manages this image separately from the website’s metadata.

To regenerate the PNG after editing the SVG, using Inkscape:

```bash
inkscape public/social-preview.svg --export-type=png --export-filename=public/social-preview.png --export-width=1280 --export-height=640
```

## Author and license

**Maurizio Napolitano** — [maurizio.napolitano@gmail.com](mailto:maurizio.napolitano@gmail.com)

Released under the **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. See [LICENSE](LICENSE).
