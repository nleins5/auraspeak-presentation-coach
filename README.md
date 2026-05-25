# VaporPitch - Presentation Coach 🎤

A high-fidelity, cinematic presentation coach and speech-to-text platform powered by Gemini AI and Whisper STT.

This project is structured as a decoupled application with independent frontend and backend modules:
- **`frontend/`**: Vite + React + Tailwind CSS client, deployable to Vercel.
- **`backend/`**: FastAPI + Uvicorn server, deployable to Render.

## Project Structure

```
presentation-coach/
├── frontend/             # React + Vite frontend application
│   ├── src/             # Frontend source code
│   ├── public/          # Static assets
│   ├── package.json     # Node dependencies and scripts
│   └── vite.config.js   # Vite configuration
└── backend/              # FastAPI python backend service
    ├── app/             # Application code (APIs, core logic)
    ├── api/             # Vercel Serverless Function entrypoint
    ├── requirements.txt # Python dependencies
    └── vercel.json      # Backend deployment config
```

## Local Development

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Production Deployment

- **Frontend**: Deploy `frontend/` folder to **Vercel** with `VITE_API_BASE` pointing to your Render backend URL.
- **Backend**: Deploy `backend/` folder to **Render** or similar Python hosting platform.
