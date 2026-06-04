# BoloBolo — Backend (Socket Relay & Translation Architecture)

The backend is a lightweight **Node.js + Express + Socket.io** server. Its only
job is to relay chat events between connected clients in real time. It does
**not** translate, store, or persist any messages — translation happens on the
**receiver's device** (explained in [Why translation is client-side](#why-translation-is-client-side)).

- **Entry point:** [`server.js`](server.js)
- **Runtime:** Node.js (CommonJS)
- **Transport:** WebSocket via Socket.io v4
- **State:** in-memory only (a single `Map` of connected users)

---

## Tech Stack

| Concern        | Choice                |
|----------------|-----------------------|
| HTTP server    | Express 5             |
| Real-time      | Socket.io 4           |
| Cross-origin   | `cors` (open in dev)  |
| Persistence    | None (in-memory `Map`)|

See [`package.json`](package.json) for exact versions.

---

## Architecture at a Glance

```
   Phone A (English)                 Server (relay only)              Phone B (Hindi)
 ┌──────────────────┐            ┌──────────────────────┐         ┌──────────────────┐
 │  types "hello"   │            │                      │         │                  │
 │                  │  message:  │  io.to('global')     │ message:│  receives        │
 │  sendMessage() ──┼──:send────▶│  .emit(...)        ──┼─:receive┼─▶ "hello"        │
 │                  │            │  (text untouched)    │         │                  │
 │                  │            │                      │         │  translate() on  │
 │                  │            │  Map<socketId,user>  │         │  device → "नमस्ते"│
 └──────────────────┘            └──────────────────────┘         └──────────────────┘
        client                       backend/server.js                  client
```

The server forwards the **original** text and its `sourceLang`. The receiving
client decides whether and how to translate it. The server never sees a
translated string.

---

## Server Lifecycle

1. Express app is created and wrapped in a raw Node `http.Server` so Socket.io
   can attach to the same port.
2. CORS is opened to `*` — required because Expo Go connects from a phone on the
   LAN, not from a fixed origin during development.
3. A health-check route `GET /` returns `BoloBolo server running. Online: N` so
   you can confirm the server is up from a browser.
4. The server listens on `process.env.PORT || 3000`.

```js
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
```

### Connection state

A single module-level `Map` tracks who is online:

```js
// socketId → { name, language }
const users = new Map();
```

This is the only state the server holds. It is **not persisted** — restarting
the server clears all presence. There is one default room, `'global'`, that
everyone joins, which keeps broadcast targets simple for this assignment.

---

## Socket Event Reference

All real-time logic lives inside the single `io.on('connection', ...)` handler.

### Client → Server (inbound)

| Event           | Payload                       | What the server does |
|-----------------|-------------------------------|----------------------|
| `user:join`     | `{ name, language }`          | Stores the user in the `Map`, joins them to the `'global'` room, then broadcasts `user:joined` to everyone. |
| `message:send`  | `{ text, sourceLang, room }`  | Looks up the sender; **relays the text as-is** to the target room via `message:receive`. Ignores messages from sockets that never joined. |
| `user:typing`   | `{ name }`                    | Forwards a `user:typing` to everyone in the room **except the sender**. |

### Server → Client (outbound)

| Event             | Payload                                                       | When |
|-------------------|--------------------------------------------------------------|------|
| `user:joined`     | `{ name, onlineCount }`                                       | After any user joins. |
| `message:receive` | `{ senderId, senderName, text, sourceLang, timestamp }`      | When a message is relayed. |
| `user:typing`     | `{ name }`                                                    | While a peer is typing. |
| `user:left`       | `{ name, onlineCount }`                                       | On disconnect. |

> The schema above is contractual — the frontend (`utils/socket.js` and
> `screens/ChatScreen.js`) depends on these exact event names and field names.

### Event flow in detail

**1. Join**

```js
socket.on('user:join', ({ name, language }) => {
  users.set(socket.id, { name, language });   // remember who this socket is
  socket.join('global');                       // single shared room
  io.to('global').emit('user:joined', {        // notify everyone (incl. joiner)
    name,
    onlineCount: users.size,
  });
});
```

**2. Send / relay**

The server attaches `senderId`, `senderName`, and a server-generated
`timestamp`, then broadcasts. Crucially, `text` is passed through untouched and
`sourceLang` rides along so the receiver knows what language it's in.

```js
socket.on('message:send', ({ text, sourceLang, room }) => {
  const sender = users.get(socket.id);
  if (!sender) return;                          // guard: un-joined socket

  io.to(room || 'global').emit('message:receive', {
    senderId: socket.id,
    senderName: sender.name,
    text,                                        // ← original text, never translated
    sourceLang,
    timestamp: new Date().toISOString(),
  });
});
```

**3. Typing** — uses `socket.to(room)` (not `io.to`) so the broadcast **excludes
the sender**; you never see your own "is typing" indicator.

**4. Disconnect** — removes the user from the `Map` and broadcasts `user:left`
with the updated online count. Sockets that disconnect before joining are
ignored.

---

## Why Translation Is Client-Side

Translation does **not** happen on the server. The receiving device calls the
MyMemory REST API itself (see `frontend/utils/translate.js`). The server only
moves original text around.

**Rationale / tradeoffs:**

- **Privacy / E2EE-friendly:** the server never reads or transmits a translated
  copy, and could later be swapped for an encrypted transport without changing
  translation behavior.
- **Per-recipient target language:** each receiver translates into *their own*
  chosen language. Two people in the same room can read the same message in Hindi
  and Bengali respectively — impossible if the server translated once.
- **Zero server cost / no API key on the backend:** the free MyMemory tier is
  called from the client; the backend stays stateless and cheap to host.
- **Tradeoff:** the same phrase may be translated N times (once per recipient)
  instead of once centrally, and each client manages its own cache. For a small
  chat app this is an acceptable cost for the privacy and per-user-language
  benefits.

### How the receiver translates (for context)

On `message:receive`, the client (`ChatScreen.js`):

1. Renders the **original** text immediately so the UI feels instant.
2. If `sourceLang !== myLanguage`, calls `translate(text, sourceLang, myLang)`
   in the background and patches the bubble in place when the result arrives.

`translate()` (`frontend/utils/translate.js`):

- Calls `GET https://api.mymemory.translated.net/get?q=TEXT&langpair=en|hi`.
- Caches results in a `Map` keyed `"text|sourceLang|targetLang"` so a phrase is
  fetched at most once per session.
- **Never throws** — on any network/API failure it silently returns the original
  text with `wasTranslated: false`, so a translation outage degrades gracefully
  instead of crashing the chat.

Supported language codes: `en` (English), `bn` (Bengali), `hi` (Hindi).

---

## Running the Backend Locally

```bash
cd backend
npm install
node server.js
```

You should see:

```
BoloBolo server listening on port 3000
```

Verify it's up by opening `http://localhost:3000/` in a browser — it returns the
online count.

### Connecting a phone (Expo Go)

`localhost` on an Android device refers to the **phone itself**, not your PC. In
`frontend/utils/socket.js`, set `SERVER_URL` to your computer's LAN IP, e.g.:

```js
const SERVER_URL = 'http://192.168.1.103:3000';
```

Find your IP with `ipconfig` (Windows) → look for the IPv4 Address. On an Android
emulator use `http://10.0.2.2:3000` instead. The client uses the `websocket`
transport directly to skip the HTTP long-poll upgrade on mobile.

---

## Notes & Limitations

- **No persistence:** message history and presence live only in memory and are
  lost on restart.
- **Single room:** everyone shares the `'global'` room; the `room` field in
  `message:send` is plumbed through but only `'global'` is used today.
- **Open CORS:** `origin: '*'` is for development convenience; lock this down
  before any production deployment.
- **No auth:** any client can join with any name; there is no authentication or
  rate limiting.
