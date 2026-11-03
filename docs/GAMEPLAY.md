# Participant results, sharing and presentation

## End of a network game

Participants see a terminal result page with their score, position and the full final ranking. The only actions are **Share result** and **Close window**. A later teacher restart does not take that participant back into a game.

The participant result is kept as a read-only snapshot in the same tab’s session storage for up to two hours. It contains the quiz title and public ranking, without questions, answers or credentials. Reloading that tab can still display the result after the teacher closes the game. Closing through the result page clears this snapshot. Browsers that block storage can still display the result until the page is reloaded.

A participant who was offline when the game ended can retrieve the final result using their existing valid credential while the game remains on the server. This does not rejoin the game; the client revokes the credential and retains only the read-only result. Expired or invalid credentials remain rejected.

## Question types

`src/services/questionTypes.ts` defines what each type asks and how it is checked, for the presenter, the server and every participant screen.

- **Multiple choice** and **true/false**: one tap sends one option. A multiple choice saved with several correct options (for example imported as `A|C`) accepts any of them, as before.
- **Several correct answers** (`multiple_select`): taps select and deselect, **Confirm** sends the whole choice. Points, streak and the correct count need exactly the correct set.
- **Poll** (`poll`): one tap sends a vote. No right answer, no points, no streak or score change, no "correct/wrong" feedback; the results show the votes. Polls are not counted in correct totals, the report review or the class score.
- **Ordering** (`ordering`, 2–8 items): the editor saves the items in the right order; every device and the server show the same shuffled order (seeded by the question id, never the right one). Taps number the items, a second tap removes one; **Confirm** needs them all. Points need the exact order; the results show the right order and how many got it.

Answers of the two multi-option types travel as `optionIds` (the whole choice) with `optionId` as its first item. The server refuses an incomplete or unknown choice and a changed retry, as for single answers. An answer counts as graded when it carries `pointsEarned` (zero for a poll). Older copies of the app reject quizzes with the new types in backups and cloud sync, so update every device.

## Teams

In the lobby the presenter picks **Teams**: none (the default) or 2–6 teams, named and coloured in the presenter's language (`src/services/teams.ts`). The teams travel in `GameSession.teams`, and each participant's team in `Player.teamId`.

- **Joining:** once the PIN is complete the join form reads the teams (`gameSync.peekTeams`, an anonymous read of the session) and the student must pick one. The server refuses a new participant without a valid team (`Team required`) and drops any team sent to a game without teams. If the presenter turns teams on or off while a student fills in the form, the join fails and the form shows the current teams.
- **Moving, randomising and naming:** the presenter can drag a participant onto another team, use the team menu on the card, randomly distribute everyone as evenly as possible, and rename each team in the lobby. The menu also supports touch and keyboard use. In a video quiz players are server-owned, yet the presenter may still change their team, and nothing else.
- **Changing the teams:** the server refuses fewer than 2 or more than 6 teams, duplicate ids and unknown colours. Removing a team, or turning teams off, leaves its members without one, including students who joined after the presenter's last snapshot.
- **Start:** whoever has no team joins the smallest, in order of arrival, so the teams stay even.
- **Score:** a team scores the average of its members, rounded, so a bigger team has no advantage. Teams without members go last. The team ranking appears above the individual ranking after each question and on the final podium; the phone shows the student's team next to their name.

## Homework

From the teacher app's library, assign a classic quiz as homework and set a deadline. Video quizzes are not supported as homework. Students open the LAN or Cloudflare link, join with a name, and answer each question alone at their own pace. They can leave and return on the same device; the server keeps their position and grades each answer once, in quiz order, without a speed bonus. Once a student has handed it in, leaving forgets their identity on the device, so on a shared tablet the next student with the same PIN starts their own homework; their answers stay with the teacher.

The server holds the private quiz definition and grades submissions. Students receive only the current public question, never the answer key. The teacher's homework page shows each student's progress and a class report by question, and can export student results or the question report as CSV. The teacher can close the homework early or extend its deadline. Results remain on the teacher's computer until the homework is deleted (or the retention period expires).

The teacher computer and Qurioso server must remain available until the deadline so students can submit. The desktop app prevents suspension while homework is open and warns before quitting. If the app is restarted, saved homework and its results are restored; a Cloudflare link may need to be shared again.

## Shared devices

Each browser keeps a random code (`src/services/deviceId.ts`, in `localStorage`) and sends it when joining a live game or homework. The code says nothing about the device. The server keeps it per participant and never sends it out: the presenter receives only `sharedDevices`, the other participants who joined from the same browser, and the lobby and the homework page mark them ("Same device as …"). It is a hint, not a proof: a shared school tablet is normal, while a private window or cleared site data gives a new code. Homework saves the codes with its answers; a live game forgets them with the room.

## Question report and review

While a network game runs, the presenter records each question when it closes, and updates it with answers accepted while its results are shown (`src/services/gameReport.ts`). The record holds counts only: participants, answers, correct answers and how often each option was chosen, never names, so it can appear on the projector. It is kept in the presenter tab's session storage, so a presenter reload keeps it, and it is cleared when the game ends or restarts.

Below the final ranking the presenter sees every question, hardest first (unanswered last), with the share of correct answers and the most chosen wrong answer, and can download it as a CSV (`;`, UTF-8 with BOM). **Review the missed questions in class** ends the game and opens a classroom activity with the questions below 70% correct, hardest first, without the video. It is not saved to the library. When no question is below 70% the button is replaced by a note.

## Sharing an image

The personal result card displayed on the page is generated as a 1080-pixel-wide PNG with height adapted to the complete ranking. It includes the quiz title, the participant’s name, score and position. It includes the podium and complete ranking, with participant names and avatars, and highlights the current player. It excludes the game PIN, session URL and credentials. The sharing hint explains that participant names will be visible. No external image requests or screen-capture permission are needed.

**Share result** opens the device’s native sharing menu when file sharing is supported. The user chooses an available social, messaging or other application; Qurioso does not post automatically or guarantee a particular destination. The image is prepared before the click to preserve the browser’s user activation.

Where file sharing is unsupported, the same action downloads the PNG for manual sharing. Cancelling the native menu does not trigger a download. If sharing fails, the page explains that pressing again will download the image. This fallback also covers ordinary HTTP LAN connections, where native Web Share is often unavailable.

**Close window** attempts to close the window and clears participant recovery data. Some browsers prevent scripts from closing tabs the user opened manually; in that case the page asks the user to close the tab or window themselves.

- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [Browser window closing restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Window/close)

## Teacher video presentation

Starting a video competition requests fullscreen from the teacher’s click. Fullscreen applies to the game container so questions, checkpoint results and controls remain available. During video playback, the video expands to fill the available stage and preserves its aspect ratio. The teacher header is hidden during fullscreen playback.

Use the video’s fullscreen button to enter or leave fullscreen, or press **Esc** to leave. The fullscreen indicator follows the browser’s actual state. If permission is denied or the API is unavailable, the page explains the fallback and the game continues within the window. Resuming after a checkpoint does not override a previous decision to leave fullscreen.

On phones and short landscape screens, complete answer text remains visible. The grid fills the available viewport, and each answer uses a measured font size that adapts to its cell, including after rotation and font loading. Buttons keep letters, colors and symbols alongside their text, with touch targets of at least 44 pixels. No answer is truncated or removed; very dense combinations necessarily use smaller text. The question remains available on the teacher's screen and to assistive technology.

These controls and messages support Italian, English and German.
