# BoloBolo Chat Translator — Claude Code Instructions

## About This Project
React Native (Expo) + Node.js chat app with live language translation.
Assignment for Cross-Platform Engineer role at BoloBolo.
Submission deadline: June 8, 11 AM.

## About the Developer
- Comfortable with: JavaScript, Node.js, Express, Socket.io
- Learning: React Native (first project)
- OS: Windows
- Editor: VS Code
- Device for testing: Android phone via Expo Go app

---

## Tech Stack — Do Not Deviate
- **Frontend:** React Native with Expo (SDK 51+)
- **Navigation:** React Navigation (Stack Navigator)
- **Real-time:** socket.io-client
- **Translation:** MyMemory free REST API (no API key)
- **Supported languages:** English (en), Bengali (bn), Hindi (hi) only
- **Backend:** Node.js + Express + Socket.io
- **State management:** useState + useEffect only (no Redux, no Zustand)
- **Styling:** React Native StyleSheet only (no NativeWind, no UI libs)

---

## Project Structure
```
bolobolo-translator/
├── CLAUDE.md
├── README.md
├── backend/
│   ├── package.json
│   └── server.js
└── frontend/
    ├── package.json
    ├── App.js
    ├── screens/
    │   ├── JoinScreen.js
    │   └── ChatScreen.js
    └── utils/
        ├── socket.js
        └── translate.js
```

---

## Socket Event Schema — Always Follow This Exactly

```js
// Client → Server
socket.emit('user:join',    { name, language })
socket.emit('message:send', { text, sourceLang, room })
socket.emit('user:typing',  { name })

// Server → Client
socket.on('user:joined',     { name, onlineCount })
socket.on('message:receive', { senderId, senderName, text, sourceLang, timestamp })
socket.on('user:typing',     { name })
socket.on('user:left',       { name, onlineCount })
```

---

## Translation Logic Rules
- Translate on **receiver's device**, not server (privacy/E2EE architecture reason)
- Cache results in a `Map`, key format: `"text|sourceLang|targetLang"`
- API: `GET https://api.mymemory.translated.net/get?q=TEXT&langpair=en|hi`
- On failure: silently show original text, no crash
- Show a small `"Translated"` label on bubbles that were translated
- Add `"Show original"` toggle per message bubble

---

## UI Rules
- WhatsApp-inspired, mobile-first
- Sent messages: right-aligned, green bubble (#25D366)
- Received: left-aligned, grey bubble (#F0F0F0)
- Each bubble: sender name (small, muted) + message text + timestamp
- Header: app name + online user count
- Typing indicator below message list

---

## Code Rules — Strictly Follow These
1. **Always write complete files** — never partial snippets or diffs
2. **Never say "add this to your existing file"** — always show the full updated file
3. **Explain new React Native APIs** — when using FlatList, KeyboardAvoidingView, SafeAreaView etc., add a 2-line comment explaining what it does and why it's needed, before the code block
4. **Functional components + hooks only** — no class components
5. **Short inline comments** — especially for anything RN-specific or non-obvious
6. **Clean, readable code** — this will be reviewed by engineers at BoloBolo

---

## Build Order
When building from scratch, always follow this sequence:
1. `backend/server.js`
2. `frontend/utils/socket.js`
3. `frontend/utils/translate.js`
4. `frontend/App.js` (navigation setup)
5. `frontend/screens/JoinScreen.js`
6. `frontend/screens/ChatScreen.js`
7. `README.md`

---

## Error Debugging Protocol
When I share an error:
- Identify root cause first in one line
- Show the complete corrected file
- Explain what was wrong and why the fix works, briefly

---

## Supported Languages (Use These Codes Only)
| Language | Code |
|---|---|
| English | en |
| Bengali | bn |
| Hindi | hi |

---

## README Must Cover
1. What this project is and why
2. Architecture diagram (ASCII)
3. Key design decisions with tradeoffs (especially client-side translation)
4. How to run locally (backend + frontend steps)
5. Live demo link (if deployed)
6. React Native migration notes (how web concepts map to RN)
7. AI tooling — how Claude Code was used
8. What I'd improve with more time

---

## Deployment (Optional but Impressive)
- Backend: deploy to **Render** free tier
- Frontend: build APK via `eas build` or share Expo QR code for live demo

---

## Assignment Context
This is a job submission for BoloBolo (real-time communications app).
Code quality, architecture reasoning, and documentation matter as much
as the working demo. Write code as if it's going into a production codebase.
