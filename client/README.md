# BaitCheck client

The BaitCheck client is a React single-page app for social engineering awareness training.

## Requirements

- Node.js 20 or newer

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` in `.env` to the backend URL during local development.

## Build

```sh
npm run build
```

The production build is written to `dist`.

## Deployment on Vercel or Netlify

- Set the root directory to `client`.
- Set the build command to `npm run build`.
- Set the output directory to `dist`.
- Set `VITE_API_URL` to the deployed backend URL in the host's environment settings.
- Redeploy after changing `VITE_API_URL`.

The backend must allow the deployed frontend origin in its CORS `CLIENT_URL` setting.
