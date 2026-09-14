# Task Tracker — Backend

REST API for [Task Tracker](https://github.com/S07K/task-tracker-frontend): user accounts with email verification, JWT authentication, per-user calendar tasks, and an AI assistant that manages tasks through chat.

Built with Express, TypeScript, MongoDB (Mongoose), bcrypt, Nodemailer and Groq, and deployed on Vercel.

## Contents

- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Security](#security)
- [Deployment](#deployment)
- [Project structure](#project-structure)

## Getting started

### Prerequisites

- Node.js **20 or newer**
- A MongoDB database (e.g. MongoDB Atlas)
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) for sending verification emails
- A [Groq API key](https://console.groq.com/keys) for the AI assistant (the free tier works; optional if you don't use the assistant)

### Setup

```bash
npm ci
cp example.env .env   # then fill in the values
npm run dev
```

The API runs on `http://localhost:5001` (or `PORT`). Open it in a browser to see the "Task Tracker API Server" status page.

`npm run dev` runs the TypeScript source directly with nodemon + ts-node and restarts on changes.

## Environment variables

Copy `example.env` to `.env` (never commit `.env`).

| Variable | Description |
| --- | --- |
| `PORT` | Port the server listens on, e.g. `5001` |
| `MONGODB_URL` | MongoDB connection string. When using the two variables below, leave the credentials **out** of it, e.g. `mongodb+srv://cluster0.example.mongodb.net/tasktracker?retryWrites=true` |
| `MONGODB_USERNAME` | Database user (optional, see below) |
| `MONGODB_PASSWORD` | Raw, **unencoded** database password (optional, see below) |
| `APP_URL` | Frontend URL. Used as the CORS origin and for links on the email verification pages, e.g. `http://localhost:5173` |
| `SERVER_URL` | Public URL of this API. Used to build the email verification link, e.g. `http://localhost:5001` |
| `GMAIL_ID` | Gmail address used to send verification emails |
| `GMAIL_PASSWORD` | Gmail App Password (not the account password) |
| `JWT_TOKEN_SECRET` | Secret used to sign login tokens. Use a long random string |
| `GROQ_API_KEY` | Groq API key for the AI assistant. Without it, `/chat` returns a "not set up" error |
| `GROQ_MODEL` | Optional Groq model id for the assistant. Defaults to `openai/gpt-oss-120b` |

### MongoDB credentials

Set `MONGODB_USERNAME` and `MONGODB_PASSWORD` to keep credentials out of the URL. They are percent-encoded when connecting (`config/mongo.ts`), so passwords containing characters like `@ : / ? # %` work without manual encoding. Don't pre-encode the password, or it will be encoded twice.

- Both set: credentials are inserted into `MONGODB_URL`, which must not already contain `user:pass@`
- Neither set: `MONGODB_URL` is used as-is (e.g. a local database, or a URL that already includes encoded credentials)
- Only one set: the server refuses to start the connection and logs an error

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API from TypeScript source with auto-reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server from `dist/` |
| `npm run ts.check` | Type-check |
| `npm run migrate:hash-passwords` | Hash any passwords still stored in plain text (add `-- --dry-run` to only report). See [Password hashing](#password-hashing) |

### Committed `dist/` and the pre-commit hook

Vercel serves the compiled `dist/index.js` (see `vercel.json`), so `dist/` is committed. A [pre-commit](https://github.com/observing/pre-commit) hook runs on every commit:

1. `ts.check` — type-check
2. `build` — recompile `dist/`
3. `add-build` — stage `dist/` into the commit

A commit fails if the type-check fails. The hook is installed automatically by `npm ci`.

## API reference

All request and response bodies are JSON.

### Authentication

`POST /users/login` returns a JWT that is valid for **1 hour**. Send it on authenticated requests:

```
Authorization: Bearer <token>
```

- No token: `401` with the text `Access Denied`
- Invalid or expired token: `200` with `{ "message": "Invalid Token", "isInvalidToken": true }` (the frontend logs the user out on this)

### Error format

Most errors are returned with HTTP `200` and an `error` object; check for it rather than relying on the status code:

```json
{ "message": "Event not found", "error": { "message": "Event not found", "code": "404" } }
```

### Users — `/users`

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/users/registerUser` | — | `{ name, email, password }` | `{ message }` and a verification email is sent |
| `GET` | `/users/verify/:id/:uniqueString` | — | — | HTML page. Link from the verification email, valid for 24 hours; an expired link deletes the unverified account |
| `POST` | `/users/login` | — | `{ email, password }` | `{ message, token, userId }`. Unverified accounts are rejected |
| `GET` | `/users/me` | ✓ | — | `{ message, user: { id, name, email, verified } }` |
| `PATCH` | `/users/me` | ✓ | `{ name }` (1–100 characters) | `{ message, user }` |
| `PATCH` | `/users/me/password` | ✓ | `{ currentPassword, newPassword }` (new: at least 8 characters, different from current) | `{ message }` |

### Events — `/events`

Every events route requires authentication and only ever reads or changes **the signed-in user's own events**. An event that belongs to someone else returns the same `404` as one that doesn't exist.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/events/getAllEvents` | — | `{ message, events }` |
| `POST` | `/events/addEvent` | `{ title, allDay, start, end, startStr, endStr, backgroundColor, url }` | `{ message, event }` |
| `GET` | `/events/searchEvent/:id` | — | `{ message, event }` |
| `POST` | `/events/searchEvent/` | Any of `{ id, title, allDay, startStr, endStr, backgroundColor }` with plain values | `{ message, events }` |
| `PATCH` | `/events/updateEvent/:id` | Any of `{ title, allDay, start, end, startStr, endStr, url, backgroundColor, borderColor, textColor }` | `{ message, event }` (the updated event) |
| `DELETE` | `/events/deleteEvent/:id` | — | `{ message, events }` (the user's remaining events) |

Event dates are stored as local date-time strings: `start`/`end` as `YYYY-MM-DDTHH:mm`, `startStr`/`endStr` as `YYYY-MM-DD`. For all-day events, `end` is exclusive (the day after the last day).

### AI assistant — `/chat`

Both routes require authentication. The assistant runs on [Groq](https://console.groq.com) (default model `openai/gpt-oss-120b`, change it with `GROQ_MODEL`) and can use four tools, which only ever act on the signed-in user's tasks: `list_tasks`, `create_task`, `update_task` and `delete_tasks`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/chat` | `{ messages: [{ role, content }], clientNow?, timeZone? }` | `{ message, reply, actions, pendingAction, changed }` |
| `POST` | `/chat/confirm` | `{ action: { type: "delete", taskIds } }` | `{ message, deleted, changed }` (the tasks that were deleted) |

- `messages` is the conversation so far; `role` is `user` or `assistant`, and the last message must be from the user.
- `clientNow` (`YYYY-MM-DDTHH:mm`) and `timeZone` (e.g. `Asia/Kolkata`) let the assistant resolve dates like "tomorrow" in the user's time zone. Without them it uses the server's UTC time.
- `actions` lists tasks the assistant created or updated (`{ type: "created" | "updated", task }`); `changed` is `true` when any task changed.
- **Deletes need confirmation.** `delete_tasks` never deletes anything: the tasks come back as `pendingAction: { type: "delete", tasks }`, and the app calls `/chat/confirm` only after the user presses Confirm.
- **Limits**, to stay within Groq's free tier (shared by everyone using one API key): the last 12 messages, 2,000 characters per message and 5 tool steps per request.
- **Errors**: `503` when `GROQ_API_KEY` isn't set, `429` (with `retryAfter` in seconds when Groq provides it) when Groq is rate-limiting, and `502` for other Groq failures.

## Security

- **Passwords** are hashed with bcrypt. Accounts created before hashing was introduced are rehashed automatically on their next successful login.
- **Event ownership**: the owner of an event always comes from the verified token, never the request body, and `id`/`groupId` can't be changed through updates.
- **Search** only accepts known fields with plain values, so MongoDB query operators (`$ne`, `$where`, …) in a request body are ignored.
- **AI assistant**: tool calls run with the signed-in user's id from the verified token, validate every argument before touching the database, and can't delete anything without the user's confirmation. Client-sent history is limited to user and assistant messages, so a client can't inject system instructions.

### Password hashing

To hash every remaining plain-text password at once (for accounts that haven't logged in since hashing was added):

1. **Deploy first.** The running server must already verify bcrypt hashes, or hashed users won't be able to log in.
2. Back up the database.
3. Put the target database's `MONGODB_*` variables in `.env` (the script reads `.env` only).
4. Run:

```bash
npm run migrate:hash-passwords -- --dry-run
```

```bash
npm run migrate:hash-passwords
```

The dry run reports how many passwords are still plain text; running it again afterwards should report 0. The script is safe to re-run.

## Deployment

Deployed on Vercel from the `develop` branch using `vercel.json`, which serves the committed `dist/index.js`.

1. Set the Node.js version to **22.x** (Settings → Build and Deployment).
2. Add all [environment variables](#environment-variables) for the Production environment.
3. Redeploy after changing environment variables; they only apply to new deployments.

## Project structure

```
├── index.ts                      # Express app: middleware, MongoDB connection, routers
├── config/
│   └── mongo.ts                  # Builds the MongoDB URL with encoded credentials
├── middleware/
│   └── auth.ts                   # Verifies the Bearer token and sets req.user
├── Models/
│   ├── EventModel.ts
│   ├── UserModel.ts
│   └── UserVerification.ts       # Email verification records
├── routes/
│   ├── events.ts                 # /events routes
│   ├── users.ts                  # /users routes
│   ├── chat.ts                   # /chat routes (AI assistant)
│   ├── passwords.ts              # bcrypt hash/verify helpers
│   └── utils.ts                  # Response helper, verification email
├── services/
│   ├── assistant.ts              # Groq tool-calling loop, tool definitions, system prompt
│   └── tasks.ts                  # Validated, user-scoped task operations used by the assistant
├── scripts/
│   └── hash-plaintext-passwords.ts
├── dist/                         # Compiled output (committed, served by Vercel)
├── example.env
└── vercel.json
```
