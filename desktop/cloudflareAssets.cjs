// Pinned official release assets. Updates require review and cross-platform checks.
// SHA256 digests and sizes come from the official GitHub release asset metadata.
const VERSION = '2026.10.2';
const ASSETS = {
  'linux-x64': ['cloudflared-linux-amd64', 40227721, '35fbdd2beb378436c7da377d7358cea8e33f9c94a6705d1d8036bf9b0d6d8005'],
  'win32-x64': ['cloudflared-windows-amd64.exe', 55329336, '12c7c887f8aaab779aef1dfa9b60673530a5adb88ecc55dd6df8f56e0b70f199'],
  'darwin-x64': ['cloudflared-darwin-amd64.tgz', 21767549, 'b64efd5a2772fc124b855f60eb3d33ba1a4f2ba67b19ddc58d32b705d42b82c9'],
  'darwin-arm64': ['cloudflared-darwin-arm64.tgz', 19808025, '529a07089ac2d46762578389230fa148e5cb6ce2689200fc006956864042d17a'],
};
module.exports = { VERSION, ASSETS };
