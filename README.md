# Resume Tailoring Engine

A full-stack web app that tailors your resume to a specific job description using AI. Upload your PDF resume, paste a job description, and get back a rewritten resume with improved bullet points and better ATS keyword coverage — ready to download as a DOCX.

**Live demo:** [your-web-domain.up.railway.app](https://your-web-domain.up.railway.app)

---

## What it does

1. **PDF parsing** — Extracts the full structure of your resume (sections, job titles, bullet points, dates, contact info) with high fidelity, handling bold/italic fonts, right-aligned dates, and multi-line bullets.

2. **ATS keyword analysis** — Uses Gemini 2.5 Flash to extract the specific technical and domain keywords an ATS would scan for from the job description, then scores your resume against them.

3. **AI bullet rewrites** — Rewrites every bullet point to be stronger and more impactful, naturally incorporating the keywords your resume is missing. You review each rewrite and choose to accept, reject, or edit it.

4. **DOCX generation** — Produces a properly formatted Word document with your approved rewrites, preserving the original layout: centered headers, section dividers, bold headings, right-aligned dates, and clickable links.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Node.js, Express 5 |
| AI | Google Gemini 2.5 Flash |
| PDF parsing | pdfjs-dist |
| DOCX generation | docx |
| Monorepo | Turborepo, npm workspaces |
| Deployment | Railway (two services: web + API) |

---

## Project structure

```
apps/
  web/        # Next.js frontend
  api/        # Express API (PDF parsing, Gemini calls, DOCX generation)
packages/
  types/      # Shared TypeScript types (ResumeStructure, AnalysisResult, etc.)
```

---

## Running locally

**Prerequisites:** Node.js 22+, a Gemini API key (free tier works)

```bash
# Install dependencies
npm install

# Set environment variables
echo "GEMINI_API_KEY=your_key_here" > apps/api/.env
echo "WEB_ORIGIN=http://localhost:3000" >> apps/api/.env

# Start both services
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

---

## Deployment

Deployed on Railway as two separate services communicating over private networking.

**Api service variables:**
```
GEMINI_API_KEY = <your key>
PORT = 3001
WEB_ORIGIN = https://<web-domain>.up.railway.app
```

**Web service variables:**
```
API_URL = http://resumeapi.railway.internal:3001
```
