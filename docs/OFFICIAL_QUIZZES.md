# Included Qurioso quizzes

## Tipi di vulcani con geopop

- Quiz author: Maurizio Napolitano.
- Category: Scienze.
- 11 questions, each with one correct answer.
- Video: https://www.youtube.com/watch?v=r4mRzXmQ6mY
- Checkpoints: 1:00, 2:15, 3:30, 4:45, 6:00, 7:30, 9:00, 10:15, 11:30, 12:30 and 13:45.

The quiz is included in new installations and remains available alongside previously saved libraries. Missing included quizzes are added to the visible catalog without rewriting personal storage or replacing an edited quiz with the same ID. Included lessons can be edited or duplicated; deleting a personal quiz does not remove the bundled catalog. In the desktop app, choose **Quiz on participants' devices**, then **Network video quiz** on its card. The same quiz is available for classroom activities.

The source is [quizzes/tipi-di-vulcani.json](../public/quizzes/tipi-di-vulcani.json), distributed at that path in both the website and desktop app. It can also be imported as a complete quiz in the editor. The cover is embedded for offline use; the YouTube video requires Internet access.

### Cover credits

“Fimmvorduhals 2010 03 27 dawn.jpg”, Boaworm, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fimmvorduhals_2010_03_27_dawn.jpg), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The included image is resized from the original. Credits, license and source links remain in the quiz and are displayed in the app.

### Content review

Question IDs and checkpoints are retained from the author's quiz. The Marsili question uses the question and answer options supplied by the author, with C as the single correct answer at 9:00. Its explanation references the low-explosivity eruption scenario discussed by [INGVvulcani, May 10, 2024](https://ingvvulcani.com/2024/05/10/nuovi-studi-sul-marsili-il-piu-grande-vulcano-del-mediterraneo/). A duplicate distractor in the basalt plateau question was also replaced without changing its correct answer.

## Parmigiana di melanzane

- Quiz author: Maurizio Napolitano.
- Category: Cucina.
- 6 questions, each with one correct answer.
- Video: https://www.youtube.com/watch?v=JYHHt6YUfYo
- Checkpoints: 0:31, 1:02, 1:48, 2:23, 2:45 and 2:54.

The source is [quizzes/parmigiana-di-melanzane.json](../public/quizzes/parmigiana-di-melanzane.json). The quiz is included in new and existing libraries for classroom activities and network video quizzes, without replacing a personal quiz with the same ID. Questions, answers, explanations and checkpoints are retained from the author's file. The cover is embedded for offline use; the YouTube video requires Internet access.

### Cover credits

“Melanzane alla Parmigiana.jpg”, Blue Lotus, [original Flickr photo](https://www.flickr.com/photos/bluelotus/244367048), [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Melanzane_alla_Parmigiana.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Credits, license and source links remain in the quiz and are displayed in the app.

## Linking a quiz

Each quiz has a link that opens it directly in the classroom activity, for example [`?app=classroom&quiz=tipi-di-vulcani`](https://qurioso.it/?app=classroom&quiz=tipi-di-vulcani). The `quiz` value is resolved in this order:

1. the ID of a quiz in the library of the browser or app that opens the link;
2. the slug of an included quiz (`tipi-di-vulcani`, `parmigiana-di-melanzane`), which works offline;
3. a quiz published with the site: a complete quiz JSON (as exported by the editor) saved as `public/quizzes/<slug>.json` is available at `?app=classroom&quiz=<slug>` after the next deploy, without code changes and without appearing in the library.

Slugs use lowercase letters, digits and hyphens. A published file is validated like a library backup before it opens. If the quiz is missing or invalid, the library opens with an error message. The address keeps the quiz while the activity is open, so reloading or copying it reopens the same activity; leaving the activity removes it. Personal quizzes live in each browser's library, so a link by ID only works where that library is.

## Sample quizzes

The sample quizzes in [src/data/defaultQuizzes.ts](../src/data/defaultQuizzes.ts) are in Italian, plus **Discover the United Kingdom** in English and **Deutschland entdecken** in German (five classic questions each, with explanations). They are shown to new libraries regardless of the interface language. They use covers and question images bundled in [public/quizzes/covers/](../public/quizzes/covers/), so they display offline, in the PWA and on filtered networks. The images are resized to a maximum width of 800 px and converted to WebP. They are precached by the service worker. New quizzes use the Manarola image as their default cover. If an image cannot be loaded, the library card and question screens show a placeholder.

### Image credits

- `earth.webp` (Viaggio nello Spazio & Scienze): “The Earth seen from Apollo 17.jpg”, NASA / Apollo 17 crew, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg), public domain.
- `manarola.webp` (Cultura Generale & Italia, and the default cover for new quizzes): “Manarola, Cinque Terre (Italy).jpg”, Davcio, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Manarola,_Cinque_Terre_(Italy).jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- `colosseum.webp` (Pantheon question in Cultura Generale & Italia): “Colosseum in Rome, Italy - April 2007.jpg”, Diliff, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Colosseum_in_Rome,_Italy_-_April_2007.jpg), [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/).
- `tower-bridge.webp` (Discover the United Kingdom): “Tower bridge London Twilight - November 2006.jpg”, Diliff, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Tower_bridge_London_Twilight_-_November_2006.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- `neuschwanstein.webp` (Deutschland entdecken): “Schloss Neuschwanstein 2013.jpg”, Thomas Wolf, www.foto-tw.de, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Schloss_Neuschwanstein_2013.jpg), [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/deed.en).
- `moraine-lake.webp` (Quiz Panoramico: Meraviglie del Mondo): “Moraine Lake 17092005.jpg”, Gorgo, own work, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Moraine_Lake_17092005.jpg), public domain.

The included images are resized from the originals. The resized CC BY-SA images are distributed under the same licenses as the originals. Credits, license and source links remain in the quiz data and are displayed in the app.
