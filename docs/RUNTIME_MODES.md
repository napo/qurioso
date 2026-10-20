# Website, local app and settings

## On qurioso.it

The website runs without a game server. You can use **Classroom activities**, create and edit quizzes, and manage your library in the browser. **Network quizzes** links point to the Windows, macOS and Linux desktop downloads: the teacher must download and run Qurioso on their computer. Installing the website as a PWA does not add a server.

Participants open the teacher’s link or scan the QR code without installing anything. A PIN entered on qurioso.it alone cannot locate the teacher’s computer: the app explains this without attempting to contact a quiz server on the website.

The website and desktop app have separate libraries. Transfer quizzes by exporting a ZIP backup from **Settings** and importing it into the other version.

## Running locally

The desktop app includes a server, so teachers can host quizzes on the LAN. A browser connected to a manually started Qurioso server can use network features when that server responds. The interface only displays a port after receiving server information.

The desktop app’s first library visit offers **LAN only for now** or **Prefer Internet access**. The choice is remembered on that device. It does not download components or open a tunnel: after enabling Internet sharing, the teacher opens a game and selects **Share over the Internet → Start sharing**.

Cloudflare is optional. The preference opens its controls automatically for a new game when Internet is selected; LAN mode does not open them. The toolbar controls remain available in either mode, and only the explicit Start sharing action starts a tunnel. Change this choice under **Settings → Internet sharing · Cloudflare**. Settings and first-run setup explain downloads and traffic and link to official documentation. See [Internet sharing](INTERNET_SHARING.md) for details.

## Settings

The library’s gear button opens:

- data management: ZIP backups, restore, question import, and access to the selected quiz’s editor for import/export;
- classic and video quiz creation;
- LAN/Cloudflare preferences, in the desktop app only;
- help and project information.

Creation buttons remain visible in the library. Import and export are also available in the editor, where they apply to the open quiz. Backups transfer content without enabling Cloudflare on the destination device.

Settings, first-run setup, runtime notices and web installation instructions support all application languages: Italian, English and German. The language selector is available within Settings, and changing it updates the current screen without resetting the sharing preference.

## Separate web and desktop workspaces

The web library focuses on classroom lessons and quiz configuration, with a separate explanation and download link for the desktop version. It does not advertise network play on individual quiz cards. Desktop opens directly into its workspace and includes both **Classroom lesson** and **Quiz on participants’ devices**. Selecting a mode changes the primary action on every quiz card; creation and editing remain available in either mode.

Connection preferences use selected colors, checkmarks, pressed states and a saved-choice message. A first-run choice remains visible until Continue. The actual game reports LAN, connecting, active Internet or interruption separately. While a tunnel is active for this game, the displayed address, copied address and both QR views use only its public URL. On interruption or stop they return to LAN addresses. LAN participants already connected can continue using their original address.
