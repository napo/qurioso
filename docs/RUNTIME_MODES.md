# Web and desktop workspaces

Qurioso Web runs classroom lessons and quiz creation in the browser. It explains the desktop version and links to its downloads; installing the PWA does not add a quiz server. Participants join the teacher's link or QR without installing anything. A PIN alone on qurioso.it cannot find a teacher's server.

Qurioso Desktop includes classroom lessons and quizzes on participants' devices. Choose the mode above the library, then use the action on the desired quiz card. The included **Tipi di vulcani con geopop** lesson remains available even when the user has an older saved library. Missing included lessons appear alongside personal quizzes without rewriting storage, duplicating an existing ID or overwriting edits. Backups still transfer personal content between separate web and desktop libraries.

## Website and desktop frames

The library, its quiz cards and the game screens (classroom activity, presenter, participant and video player) are shared. Only the frame around the library depends on the environment, chosen in `App.tsx`:

- **WebShell** (website, and a local server opened in a browser): page header with language, guide, sound, PIN entry when a server is available, a link back to the landing page, the introduction to the workspace and a footer with author, license and **Build & GitHub**.
- **DesktopShell** (`window.quriosoDesktop`): a compact toolbar with the logo, a server badge (**LAN**, **Internet active** or **Internet interrupted**, following Cloudflare sharing; the tooltip shows the port), a single **New quiz** button with a menu for classic or video quizzes, and **Settings**. The library starts with a two-option segmented control, **Classroom lesson** / **Quiz on participants' devices** (`aria-pressed` on the active option). The detailed explanation of the two modes is in the guide. There is no PIN entry, landing-page link or footer.

Settings contains backups, question import, quiz creation, the language, the guide, sound and **About Qurioso** (version, author, license, GitHub and **Build & GitHub**), in both environments.

The desktop window has a native menu besides **Qurioso** (activity modes, updates, quit), **Edit** and **View**:

- **File**: New quiz (Ctrl/Cmd+N), New video quiz (Ctrl/Cmd+Shift+N), Import questions, Backup and restore.
- **Help**: Guide (F1), About Qurioso.

These commands reach the renderer through `quriosoDesktop.menu` in `desktop/preload.cjs`. They are enabled only while the library or Settings is visible, so a menu shortcut cannot interrupt a game or discard changes in the editor. The window title shows the name of the quiz open in the editor, classroom activity or presenter screen (`<quiz> — Qurioso`), and `Qurioso` elsewhere. Cloudflare is configured per game, with no global first-run or settings preference. At the start of each new network game, read the optional Cloudflare information or close the modal to use LAN only. Starting sharing closes the modal immediately and reports progress on the teacher screen. The Cloudflare switch stops sharing and directly restarts it once authorized for that game; the first activation opens its information controls and is hidden throughout fullscreen. No download or tunnel starts merely by opening the choice. See [Internet sharing](INTERNET_SHARING.md).

Active public sharing is the single advertised address for copying and both QR views. Interruption or stop restores LAN addresses. Existing LAN clients remain connected independently of the public tunnel.

Interface text and the tutorial support Italian, English and German.

### Desktop language

At startup the desktop app reads the operating system's preferred language. Italian, English and German are used directly; any other language falls back to **English**. This language labels the whole native menu (including Edit, View, updates and quit) and is the default interface language when the user has not chosen one. Choosing a language in the app (Settings, or the guide) relabels the native menu immediately and is remembered for the next launch. Labels live in `desktop/menuText.cjs`. Update dialogs are still in Italian.
