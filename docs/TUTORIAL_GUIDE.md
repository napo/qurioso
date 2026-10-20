# In-app tutorial guide

The **Guide** link in the home navigation opens an interactive manual at `?app=guide&lang=en`. The library header and Settings also link to it. It is separate from the existing technical build/project information dialog.

The guide supports Italian, English and German and contains eleven tutorials:

1. Choosing browser or desktop usage.
2. Running classroom activities.
3. Hosting a network quiz.
4. Joining and answering from a phone.
5. Creating quizzes, categories and image credits.
6. Preparing video questions and checkpoints.
7. Sharing outside the LAN through Cloudflare.
8. Backing up and transferring the library.
9. Importing questions or complete quizzes.
10. Sharing final results and closing the participant window.
11. Troubleshooting common problems.

Each tutorial has prerequisites, a numbered step selector, a progress indicator and Back/Next controls. Desktop screens show a topic index; mobile screens use a topic selector. Steps include contextual links to the library, classroom activities, executable downloads or official Cloudflare references where appropriate. Reading the guide does not start a game, download a component or enable Internet sharing.

Direct links include a stable topic ID and a one-based step number, for example `?app=guide&topic=internet&step=3&lang=en`. Browser history restores the tutorial position and language. Switching language within the page preserves the current topic and step. Unknown topics and invalid step numbers fall back to valid content.

## Maintenance

Content lives in `src/i18n/guide.ts`; home/header labels live in the small `guideNavigation.ts` module so the manual can be loaded lazily. `TutorialGuide.tsx` renders the same structure for every language. Every supported language must provide every topic with the same number of steps, without an English fallback.

When a user flow changes, update the corresponding tutorial in all three languages. Keep product instructions separate from implementation details, and distinguish the static website, classroom mode, local network hosting and optional Internet sharing. Repository documentation and GitHub communication remain in English.

Tests cover navigation, language changes, direct links, browser history, home entry links and the absence of service requests. Electron smoke checks the real guide route at desktop and phone sizes in all languages.

## Screenshots

Every chapter includes a real application screenshot using the included **Tipi di vulcani con geopop** quiz. Screenshots are captured separately in Italian, English and German. They can be enlarged in the guide. Participant names and scores in examples are illustrative.

Run `npm run desktop:guide-screenshots` to rebuild and capture the production interface into `public/guide/{it,en,de}/`. The script uses a temporary, isolated profile and its own game server, never the user's library. It opens the Cloudflare information modal without downloading a component or creating a public tunnel. The teacher, editor, import, settings, classroom video, participant answer and final result views come from actual React screens and the bundled quiz. The shared result PNG is also saved for visual verification. Rebuild the app after capturing to include newly generated images in distribution files.
