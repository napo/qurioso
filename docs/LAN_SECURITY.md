# LAN multiplayer protocol and security

The LAN workflow still uses a public six-digit PIN and QR link, without accounts. Classroom activities do not use these endpoints and continue to run without a server. No scoring formula or quiz branding has changed.

## Session ownership

A presenter first obtains a server-generated, cryptographically random 256-bit credential with `POST /api/presenter-token`. This is an accountless creation capability, not an administrative login: any LAN user may start a separate quiz. The credential permits exactly one new room and cannot claim another presenter's PIN. Unused credentials expire after five minutes.

`POST /api/session/create` requires `Authorization: Bearer <hostToken>`. After creation the same secret is bound to that room. Both this route (which also accepts updates) and `POST /api/session/:pin/state` require its owner token and an integer `revision` matching the latest host revision. Each new accepted host write increments that revision; stale writes receive HTTP/WS status 409. `DELETE /api/session/:pin` requires the owner token, removes the room and closes all its sockets. A deleted room cannot be recreated using its old token.

A join through `POST /api/session/:pin/join` creates a separate 256-bit `playerToken`, scoped to that room and player ID. Incoming score, bot and result fields are ignored; new players start with zero points. An existing player ID can only be rejoined with its matching credential. Answers require that player token and cannot be sent on another player's behalf.

Credentials stay in server/client memory. They are absent from session objects, URLs, QR links, localStorage and BroadcastChannel. Host snapshots are no longer written to browser storage or used as a multiplayer fallback. A browser refresh starts a new host/player lifecycle as before; automatic socket reconnects keep their existing identity and credentials. An old client must be refreshed when upgrading the server because unauthenticated protocol messages are intentionally incompatible.

## WebSocket authorization

`/ws` accepts text JSON with a maximum payload of 1 MiB. Within ten seconds the socket must send `REGISTER` with `pin`, `role`, `token` and, for participants, `playerId`. The credential determines the authorized role; a client's `role` claim alone grants no privileges. Each subsequent message is scoped to that authenticated room/identity and the room must still exist.

- Presenter: `SESSION_STATE_UPDATE` with the matching revision; `REQUEST_SESSION_SYNC`.
- Participant: `PLAYER_ANSWER` for its own identity; `REQUEST_SESSION_SYNC`; bounded, allowlisted `REACTION` messages.
- Creation, joining and deletion use REST. WebSocket attempts to forge joins, create/delete sessions or relay arbitrary event types are rejected rather than broadcast.

Reconnecting sockets must authenticate again with the same secret. HTTP polling uses the same authorization and remains active when WebSocket is unavailable. Host writes and deletion are serialized by the client to preserve transition order and avoid a pending write resurrecting a deleted room.

## Public and private views

`GET /api/session/:pin` and participant sockets receive a sanitized participant view. Only a valid presenter bearer token selects the private view. A supplied invalid bearer token is rejected rather than silently downgraded.

The question is rebuilt from an explicit field allowlist, including real option IDs and text, and never includes `isCorrect`, explanation text or the whole quiz. During an open question, participant state contains no answer submissions, last-answer correctness or newly awarded score/streak/statistics. Scores are frozen at the start of the round, including HTTP polling and participants joining mid-round. Only the presenter receives individual answer events. The normal result view becomes available when the presenter closes the question; the existing host code still calculates scores.

## Validation and limits

HTTP JSON and WebSocket frames are capped at 1 MiB. State, PIN, IDs, players, options, timing, numeric statistics and event types are validated before mutation. Unknown state fields are discarded; prototype-related keys, malformed values, duplicate option IDs and cross-room state writes are rejected. Join/answer data cannot overwrite presenter state. Concurrent joins and accepted answers survive an in-flight host snapshot of the same round.

The server allows up to 100 active sessions, 500 players per session and 256 unconsumed presenter credentials. Session APIs return JSON errors without stack traces. No wildcard CORS is permitted: browser API/WS origins must match the server, with an explicit loopback-only exception for Electron's stable `http://qurioso.localhost` origin. Native clients without an Origin header still need the same credentials. Dynamic ports and LAN PIN/QR links are unchanged.

## Timing, score integrity and reconnect recovery

Each new question gets a fresh server-generated `GameSession.roundId`. This is ephemeral multiplayer metadata, not a change to the saved Quiz format. Both HTTP and WebSocket answers must name that round and its question ID. Old submissions cannot apply to a later question or replay of the same quiz, even if the presenter clock repeats a timestamp.

At question activation, the server records `performance.now()` and freezes the configured duration. New answer acceptance and expiry use this monotonic clock, independently of presenter/student wall clocks and the presenter's UI timer. Editing a later snapshot's duration cannot extend the active round. A manual close is effective when its authenticated update reaches the server; even if the presenter disconnects before that update arrives, the independent server deadline still applies.

The reported `timeTakenMs` remains validated for protocol compatibility but is ignored for grading. The recorded value is the server receipt elapsed time minus a fixed 100 ms LAN allowance, clamped at zero and rounded to the nearest 100 ms. The allowance is the same for everyone, never based on a client-provided RTT. It does not extend the acceptance deadline. The existing speed, multiplier and streak formula is unchanged and uses this recorded time.

**Observable difference:** speed points and total response-time statistics can differ from older versions because they use server receipt time rather than a student-controlled time. There is no claim of millisecond accuracy or exact per-device latency compensation. A slower network can still affect results, and a new submission received after the server deadline is rejected. Synthetic bot timing and offline/classroom scoring are unchanged.

The first accepted choice/time is immutable. Same-choice retries acknowledge it without emitting another answer event or adding points, including retries after closure; a different choice is rejected. Authenticated participants receive an `ownAnswer` receipt with their own choice/time, never correctness or points before results. This restores the submitted choice after a transient connection loss. Existing identities, credentials and scores survive socket reconnects and credentialed rejoin in the same running client; a page refresh/server restart is not recovery of those in-memory credentials.

Presenter writes use a random `operationId`, frozen request body and base revision across retries during a brief outage (a roughly 12-second retry window plus the request currently in flight). The server remembers the last 64 operation fingerprints per room. An identical retry acknowledges the current state without applying the write twice; a changed payload under the same ID is rejected. A forgotten old operation still fails the existing revision check. Writes remain serialized, and rejected conflicts are not rebased onto a newer revision.

In addition to host-write revisions, an increasing server `sequence` orders state snapshots containing joins/accepted answers. Late HTTP/WS snapshots cannot replace a newer snapshot, including within the same host revision. Remaining-time samples cannot move the countdown backwards. The server also validates state transitions and sequential question indices, so a fresh revision alone cannot reopen an old question.

The host grades accepted answer receipts that arrived while it was disconnected, even if it has locally entered the result view. Before advancing, it flushes pending writes and reconciles accepted answers. Advancing waits for this reconciliation instead of losing submissions. Socket recovery retains the same PIN and credentials; it does not create another game. These changes add no accounts, login screens, external services or stored credentials.

## Remaining risks and deployment scope

- HTTP/WS traffic is not encrypted. A network observer who can capture a bearer secret can impersonate its owner. Use a trusted LAN; Internet hosting requires TLS and deployment-level access controls.
- This is room ownership protection, not admission control for the school network. Anyone who knows a public PIN may join with a new identity; anyone on the LAN may create their own room. This change does not attempt comprehensive abuse/rate-limit or denial-of-service protection.
- The presenter remains trusted to publish its quiz state and calculate scores. The scoring formula is unchanged, but participant response times are now measured by the server as described below. The presenter remains trusted to grade; this is not protection against a malicious presenter.
- Sessions and credentials are ephemeral. A server restart removes them. An occupied PIN fails closed instead of overwriting an existing room.

## Regression checks

`npm test` includes adversarial REST/WS ownership tests, player impersonation, incorrect PIN, input and payload limits, state redaction before results, stale revision protection, authenticated reconnects and the real host/player flow (including HTTP fallback). Existing classroom tests assert that no server request is made. `npm run desktop:prepare` followed by `npm run desktop:smoke` exercises Electron's stable origin, local server, authenticated participant socket, rejected participant deletion, answer/results exchange, persistent library origin across port changes and server shutdown.
