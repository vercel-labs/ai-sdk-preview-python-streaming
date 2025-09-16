# ChatGPT Restructure Tool

A two-part Vercel-ready application that restructures ChatGPT JSON exports into
clean Markdown notes. The FastAPI backend parses each conversation and generates
Problem/Solution style Markdown files, bundles them into a ZIP archive, and the
Next.js dashboard provides drag-and-drop uploads, download management, and a
persistent cache of previous results.

## Project structure

```
backend/           # FastAPI application deployed as a Vercel serverless function
  app/main.py      # API endpoints and ChatGPT export processing logic
  requirements.txt # Python dependencies
frontend/          # Next.js 14 dashboard with Tailwind CSS
  app/             # App Router pages and UI components
  public/          # Static assets
vercel.json        # Vercel build configuration and routing rules
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+

## Setup

### Backend

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\\Scripts\\activate
pip install -r backend/requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Local development

Run the FastAPI backend (from the repository root):

```bash
uvicorn backend.app.main:app --reload --port 8000
```

In a separate terminal, start the Next.js development server:

```bash
cd frontend
npm run dev -- --port 3000
```

The dashboard expects the backend to be reachable on `http://localhost:3000/api`
when running locally. The included `frontend/next.config.js` file proxies API
calls to `http://localhost:8000/api`, so start the backend before launching the
Next.js dev server. Alternatively, you can query the FastAPI endpoints directly
at `http://localhost:8000/api`.

### Key API routes

- `GET /api/health` &mdash; Readiness probe.
- `POST /api/process` &mdash; Accepts one or more `conversations.json` files and
  returns generated Markdown alongside a ZIP archive (Base64 encoded).

## Testing & quality

- Backend: `uvicorn backend.app.main:app --reload` (for manual validation).
- Frontend: `npm run lint` (requires installing dependencies first).

## Deployment

The included `vercel.json` configures a single Vercel project with a Python
Serverless Function for the backend and a Next.js frontend:

- Requests to `/api/*` are served by `backend/app/main.py` using the
  `@vercel/python` runtime.
- All other routes are handled by the Next.js build located in `frontend/`.

### Steps

1. Push the repository to GitHub.
2. Create a new Vercel project and import the repository.
3. Use the root of the repository as the project directory.
4. No custom environment variables are required for basic operation.
5. Deploy & enjoy structured Markdown exports for your ChatGPT conversations.

## Support

If you encounter issues parsing unusually formatted exports, inspect the
response payload from `/api/process` for contextual error messages and adjust
your input files accordingly.
