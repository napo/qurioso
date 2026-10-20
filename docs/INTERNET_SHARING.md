# Experimental Internet sharing

This feature is available in the desktop app for Windows x64, Linux x64, and macOS Intel/Apple Silicon. The website and LAN mode work without Cloudflare.

## Testing the desktop app from a checkout

Run `npm run desktop:dev` from the repository to build and open the current desktop app. `npm run desktop:pack` creates a runnable desktop directory; on Linux the executable is `release-desktop/linux-unpacked/qurioso`. These local builds include uncommitted changes and do not publish a release. On Linux, use `desktop:pack` to prepare the unpacked sandbox helper correctly; for an older build, run `node scripts/prepare-desktop-directory.mjs` before launching. See [Linux startup notes](DEVELOPMENT.md#desktop-installers-electron).

Prefer Internet access in Settings, start a network quiz, then use **Share over the Internet → Start sharing** in the teacher toolbar. Wait for the connected state and the `trycloudflare.com` address. To test access from outside the LAN, turn off Wi-Fi on a phone and use mobile data to open the public link or scan the QR code. Keep the teacher app open. A firewall or download failure is reported in the sharing panel with links to Cloudflare documentation and service status.

## Usage

1. On first launch, choose **Prefer Internet access**, or enable it later under **Settings → Internet sharing · Cloudflare**. This choice does not start downloads or tunnels. Then start a network quiz in the desktop app.
2. Cloudflare controls open automatically for a new game if Internet is preferred. Otherwise press the globe button in the teacher’s toolbar; the controls remain available in LAN mode too.
3. Read the service information and press **Start sharing**. No account, terminal or manual installation is required.
4. On first use, the app downloads the official `cloudflared` component for the system, displays progress, and checks its size and SHA-256 hash. The component and its Apache 2.0 license are stored in Qurioso’s app data folder and reused.
5. Once the tunnel connects, its public address is selected for the game link and QR code. The public address is the only advertised choice while sharing is active. On interruption or stop, the link and both QR views return to LAN addresses.
6. **Stop sharing** closes the tunnel. Leaving the game, navigating to another desktop screen, reloading the page or closing the app also stops sharing. Sharing must be enabled again after a reload.

The teacher continues to use their library in the local app. The public link opens the participant page. Sharing applies only to the selected game; teacher APIs and other games are inaccessible through the tunnel.

## External service and limits

While sharing, game traffic, including participant names and answers, passes through Cloudflare. Anyone with the public address can access the participant page. Keep the teacher’s computer and Internet connection running.

Quick Tunnels require no registration or domain. They are intended for testing and demonstrations, offer no uptime guarantee, and generate a different temporary hostname on each start. Cloudflare documents a limit of 200 in-flight requests; this does not equal a guaranteed number of participants. Test the feature with the intended network and load.

These references remain available in the panel, including when sharing is off or an error occurs:

- [Quick Tunnel guide](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Official Cloudflare downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)
- [Cloudflare service status](https://www.cloudflarestatus.com/)
- [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)

## Troubleshooting and recovery

- **Download unavailable:** the required version may have been withdrawn. Retry or update Qurioso; the app does not run a different, unverified version.
- **Download blocked:** check Internet access, firewalls and proxies; consult the guide or network administrator. Disabling the firewall is not required.
- **Integrity check failed:** the file is not executed. Retry the download; the cached copy is verified before each start too.
- **Launch blocked:** check device restrictions with its administrator. Automatic downloads do not bypass operating system controls.
- **Connection interrupted:** the app checks the component’s connection readiness using its local `/ready` endpoint. During recovery it withdraws the Internet address from link/QR selection while retaining LAN addresses. If the process exits, the app displays an error with **Retry**; the new link may change.

Errors distinguish the Cloudflare component from Qurioso’s local server. **Technical details → Copy details** copies the version, phase, error code and HTTP/exit code when available. It excludes credentials, names, answers and raw component logs.

## Implementation and verification

`desktop/cloudflareAssets.cjs` pins the version, assets, sizes and SHA-256 hashes of official downloads. Updating this manifest requires a new Qurioso release and validation of each platform’s assets. The app does not automatically use `latest`; `cloudflared` runs without a shell, with self-updating disabled and isolated configuration. It is not installed as an operating system startup service.

The tunnel targets the local server with a random Host value known only to the native processes. The server accepts this ingress only on loopback, checks the public Origin and restricts HTTP and WebSocket access to participants in the shared game. Existing teacher and participant authentication remains active. IPC only exposes status, start with a PIN, and stop, to the app’s main local renderer.

Automated tests cover tampered or withdrawn downloads, unexpected redirects, cache, cancellation, timeouts, interruption/recovery, blocked teacher APIs, game isolation and HTTP/WebSocket answers. The standard Electron smoke test checks the panel and bridge without publishing anything.

For an explicit test using the real Cloudflare service:

```bash
npm run desktop:prepare
npm run desktop:internet-smoke
```

This test downloads the component and exposes only a temporary synthetic game, verifies HTTPS entry, WebSocket, HTTP answers and participant recovery, then stops the tunnel and server. It does not read the user’s library.
