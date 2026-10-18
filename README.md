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

Open Qurioso in your browser, display the questions and select the answer agreed on by the class. Use one device, with or without a projector. No installation required.

**Network quizzes — Quiz in Rete**

Run Qurioso on the teacher’s computer. Students join from their browsers using a QR code and PIN. **All devices must be on the same local network (LAN or Wi-Fi).**

Desktop installers are not available yet. Until then, network quizzes require the local setup below.

## What you can do

- Create multiple-choice and true/false questions.
- Upload images or find them on Wikimedia Commons.
- Add a video file or a YouTube/Vimeo link, with questions at chosen moments.
- Save quizzes in your browser and import or export them as JSON.
- View scores and results during network quizzes.

No account or API keys are required. Online videos need Internet access and must allow embedded playback. Export your quizzes before changing browser or computer, or clearing site data.

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
- [Downloads](https://napo.github.io/qurioso/#quiz-in-rete)
- [Social preview image](public/social-preview.png)

Created by **Maurizio Napolitano**. Licensed under [AGPL-3.0-or-later](LICENSE).
