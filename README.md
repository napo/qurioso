<p align="center">
  <a href="https://napo.github.io/qurioso/">
    <img src="public/logo-on-white.png" alt="Qurioso" width="460" />
  </a>
</p>

<p align="center"><strong>Bring curiosity into the classroom.</strong></p>

Create quizzes with images and videos. Discuss answers together, or let everyone answer from their own device.

**[Open Qurioso](https://napo.github.io/qurioso/)** · [Italiano](https://napo.github.io/qurioso/?lang=it) · [English](https://napo.github.io/qurioso/?lang=en) · [Deutsch](https://napo.github.io/qurioso/?lang=de)

## Choose how to play

**Classroom activities — Attività in classe**

Open Qurioso in your browser, display the questions and select the answer agreed on by the class. Use one device, with or without a projector: answers are labelled A, B, C, D and can be chosen with the keyboard, and the activity has a fullscreen mode. No installation required.

**Network quizzes — Quiz in Rete**

Run the Qurioso desktop app on the teacher’s computer. Students join from their browsers using the teacher’s link or QR code, with a PIN. **All devices must be on the same local network (LAN or Wi-Fi)**, unless the teacher turns on the optional Cloudflare sharing for that game to let students join over the Internet.

Desktop builds include the local server and do not require Node.js: Windows `.exe`, macOS `.dmg` (Intel and Apple Silicon), Linux `.AppImage`, `.deb` and `.rpm`. Download the available installers from [Releases](https://github.com/napo/qurioso/releases) or the [website](https://napo.github.io/qurioso/#quiz-in-rete). Beta releases are labeled “In beta”.

## What you can do

- Create multiple-choice and true/false questions.
- Upload images or find them on Wikimedia Commons.
- Add a video file or a YouTube/Vimeo link, with questions at chosen moments.
- Save quizzes in your browser or in the desktop app, import or export them as JSON, and back up the whole library to a ZIP file.
- Import questions from CSV or JSON files.
- Use the interface in Italian, English or German. Sample quizzes are included in all three languages, and the desktop app follows the system language (English if it is not supported).
- View scores and results during network quizzes.

No account or API keys are required. Online videos need Internet access and must allow embedded playback. Back up your library before changing browser or computer, or clearing site data.

## Run locally

Requires **Node.js 22.12 or later**.

```bash
npm ci
npm run dev
```

Open the address printed in the terminal. Add `?app=network` to open the local quiz app.

The server chooses a free port at startup. To keep the same browser library across launches, use a fixed port, for example `PORT=4444 npm run dev`.

## More information

- [Developer guide: builds, storage and GitHub Pages](docs/DEVELOPMENT.md)
- [Share desktop quizzes over the Internet with Cloudflare](docs/INTERNET_SHARING.md)
- [Website, local app and settings](docs/RUNTIME_MODES.md)
- [Participant results, sharing and video presentation](docs/GAMEPLAY.md)
- [In-app tutorial guide](docs/TUTORIAL_GUIDE.md)
- [Included quizzes and image credits](docs/OFFICIAL_QUIZZES.md)
- [Library backup and restore](docs/LIBRARY_BACKUP.md)
- [Question import from CSV and JSON](docs/QUESTION_IMPORT.md)
- [Downloads](https://napo.github.io/qurioso/#quiz-in-rete)
- [Social preview image](public/social-preview.png)

Created by **Maurizio Napolitano**. Licensed under [AGPL-3.0-or-later](LICENSE).
