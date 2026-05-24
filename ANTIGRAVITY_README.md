# Presentation Coach

Standalone source for the presentation practice voice coach.

## Run Locally

Backend:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
npm run dev:backend
```

Frontend:

```bash
npm install
npm run dev:ui
```

Open:

```text
http://127.0.0.1:5173/
```

API:

```text
POST /v1/chat/presentation
POST /v1/audio/transcriptions
```

## Deploy

```bash
vercel --prod
```
