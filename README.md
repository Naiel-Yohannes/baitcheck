# BaitCheck

BaitCheck helps people practise spotting social engineering in short, realistic conversations.

## The problem

Social engineering can lead to security breaches. People need practice responding to suspicious requests, not slides alone. BaitCheck is designed for an Ethiopia facing context: the prototype supports English and Amharic and uses mobile money, Telegram and workplace scenarios.

## 🍿 Video

[![BaitCheck demo video](https://img.youtube.com/vi/cbzNuaDUl6o/hqdefault.jpg)](https://youtu.be/cbzNuaDUl6o)

[Watch the full demo on YouTube](https://youtu.be/cbzNuaDUl6o): registration, the scenarios in English and Amharic, the report, and the admin view.

## What it does

- Offers short, guided conversations in English or Amharic.
- Shows a persona card with scenario only data for practice.
- Filters unsafe input, checks selected behaviours and gives a stored score and feedback report.
- Supports individual learners and organization accounts. Organization admins can see aggregate scores and session summaries, but not employee transcripts or written feedback.

## Scenarios and techniques

- **The Urgent Bank Call** (`mobile-money-call`): authority, urgency, pretexting, pressure and fear.
- **The Telegram Job Offer** (`telegram-job-offer`): reward lure, rapport building, scarcity and a growing request.
- **The Boss Who Needs a Favor** (`boss-favor`): impersonation, urgency, secrecy, authority and pressure.

## How it works: code controls, AI talks

Stages, safety checks, code based checkpoints and score calculation are controlled by ordinary server code. The AI writes attacker lines, judges language dependent checkpoints and writes feedback. Code combines checkpoint results into the score. The score and report are stored when the session is finished; the AI does not calculate or recalculate the score.

```text
React + Vite client
        │ HTTPS / JSON
        ▼
Express API ───── MongoDB
        │
        └── server/ai/llm.js ─── Gemini API (when AI_PROVIDER=gemini)
```

## Safety by design

- A persona card supplies fictional scenario data; the chat keeps a permanent safety banner.
- Attacker prompts set boundaries for requests and plain-language dialogue.
- Input checks block messages containing disallowed content; output sanitization screens attacker replies.
- Prompt instructions treat learner text as data, not instructions.
- API rate limits and an LLM request quota limit traffic and provider calls.
- The server stores session messages for the learner's report; organization summaries do not expose transcripts, feedback text or reports.

### Known limits

- Filters and prompt rules are safety nets, not guarantees.
- The free Gemini tier may use inputs and outputs to improve Google's products; check the current terms for the model and account you use.
- Amharic text needs review by a native reader.
- AI checkpoint judgements can vary between runs; the finished report is stored once.
- Free hosting can sleep while idle, so the first request may take longer.

## Run locally

Use Node.js 20 or newer, MongoDB, and two terminals. Do not commit `.env` files or secrets.

**Server:**

```sh
cd server
npm install
cp .env.example .env
# Set PORT, NODE_ENV, MONGO_URI, JWT_SECRET, GEMINI_API_KEY, LLM_MODEL,
# CLIENT_URL, AI_PROVIDER, and AI_FALLBACK_TO_SCRIPT in .env as needed.
npm run dev
```

In another terminal, run `cd server && npm run seed` to create the fictional demo organization and accounts. The seed prints demo emails. To check a running server, use `cd server && npm run smoke`; `SMOKE_URL` can point to a non-local server.

**Client:**

```sh
cd client
npm install
cp .env.example .env
# Set VITE_API_URL in .env to the local backend origin.
npm run dev
```

Run the server tests with `cd server && npm test`; build the client with `cd client && npm run build`.

## AI scripts

From `server`, `npm run ai:models` lists available model IDs, `npm run ai:ping` checks connectivity, `npm run ai:try -- <scenarioId> <en|am> [stageIndex]` tries attacker dialogue, and `npm run ai:report -- mobile-money-call <en|am>` creates sample reports. These scripts need the relevant Gemini configuration; they do not add credentials to the repository.

## Deployment

**Render server:** use repository root directory `server`, build command `npm install`, start command `npm start`, and health check path `/api/health`. Configure `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `LLM_MODEL`, `CLIENT_URL`, `AI_PROVIDER` and `AI_FALLBACK_TO_SCRIPT` in Render's environment settings. `CLIENT_URL` must allow the deployed frontend origin, such as `<LIVE_FRONTEND_URL>`.

**Vercel client:** use root directory `client`, build command `npm run build`, and output directory `dist`. Set `VITE_API_URL` to `<LIVE_BACKEND_URL>` in the Vercel environment settings, then redeploy after changing it. The server's `CLIENT_URL` must include the deployed frontend origin. Set `AI_PROVIDER=fake` for the deterministic local attacker or `AI_PROVIDER=gemini` with Gemini configuration for AI dialogue, judging and feedback. `AI_FALLBACK_TO_SCRIPT=true` enables scripted attacker lines when attacker generation fails; the default is `false`.

## Fictional demo data

The seed creates these fictional demo accounts at `demo.example.com`:

- `admin@demo.example.com` — organization admin
- `hana@demo.example.com`, `selam@demo.example.com`, `dawit@demo.example.com` — employees
- `meron@demo.example.com` — individual

Seed demo password: `DemoPass123`. Organization join code: `BEAT42`. These credentials and users are fictional demo data; do not use them for real accounts or production.

## Roadmap

Ideas listed for future work: prize-message, fake IT helpdesk and online-friend scenarios; organization invites; charts; and streaming responses. These are not promises of availability.

## Team

- Jiregna Dereje   CTC-4151-26
- Naiel Yohannes    CTC-264-26
- Nahom Laikemariam    CTC-7614-26
- Nebiyu Amare    CTC-1104-26
- Yonatan Getachew   CTC-4561-26

