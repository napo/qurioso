# Participant results, sharing and presentation

## End of a network game

Participants see a terminal result page with their score, position and the full final ranking. The only actions are **Share result** and **Close window**. A later teacher restart does not take that participant back into a game.

The participant result is kept as a read-only snapshot in the same tab’s session storage for up to two hours. It contains the quiz title and public ranking, without questions, answers or credentials. Reloading that tab can still display the result after the teacher closes the game. Closing through the result page clears this snapshot. Browsers that block storage can still display the result until the page is reloaded.

A participant who was offline when the game ended can retrieve the final result using their existing valid credential while the game remains on the server. This does not rejoin the game; the client revokes the credential and retains only the read-only result. Expired or invalid credentials remain rejected.

## Sharing an image

The personal result card displayed on the page is generated as a 1080 × 1080 PNG. It includes the quiz title, the participant’s name, score and position. It excludes the game PIN, session URL, credentials and other participants’ names. No external image requests or screen-capture permission are needed.

**Share result** opens the device’s native sharing menu when file sharing is supported. The user chooses an available social, messaging or other application; Qurioso does not post automatically or guarantee a particular destination. The image is prepared before the click to preserve the browser’s user activation.

Where file sharing is unsupported, the same action downloads the PNG for manual sharing. Cancelling the native menu does not trigger a download. If sharing fails, the page explains that pressing again will download the image. This fallback also covers ordinary HTTP LAN connections, where native Web Share is often unavailable.

**Close window** attempts to close the window and clears participant recovery data. Some browsers prevent scripts from closing tabs the user opened manually; in that case the page asks the user to close the tab or window themselves.

- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [Browser window closing restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Window/close)

## Teacher video presentation

Starting a video competition requests fullscreen from the teacher’s click. Fullscreen applies to the game container so questions, checkpoint results and controls remain available. During video playback, the video expands to fill the available stage and preserves its aspect ratio. The teacher header is hidden during fullscreen playback.

Use the video’s fullscreen button to enter or leave fullscreen, or press **Esc** to leave. The fullscreen indicator follows the browser’s actual state. If permission is denied or the API is unavailable, the page explains the fallback and the game continues within the window. Resuming after a checkpoint does not override a previous decision to leave fullscreen.

On phones and short landscape screens, the answer screen fits the dynamic viewport without scrolling. Buttons show a letter, color and symbol; an instruction directs participants to read the complete question and answers on the teacher’s screen. The teacher displays the same letters. Full answer text remains in each button’s accessible name, and remains visible in larger browser windows. Layouts use two or three columns, depending on the number of answers and available height, with touch targets of at least 44 pixels. Quiz texts are never shortened or changed.

These controls and messages support Italian, English and German.
