# AI Interview Prep
 
AI-powered interview preparation platform that analyzes your resume and a target job description to generate a personalized match score, technical & behavioral interview questions, skill gap analysis, and a day-wise preparation roadmap. Also generates a tailored, ATS-friendly resume PDF for the job.
 
**Live demo:** [ai-interview-prep-mu-five.vercel.app](https://ai-interview-prep-mu-five.vercel.app)
 
<!-- Add 2-3 screenshots or a short demo GIF here, e.g.:
![Report page](docs/report-page.png)
-->
 
## Features
 
- 🔐 **Authentication**: JWT (cookie-based) auth with register/login/logout and token blacklisting on logout
- 📄 **Resume Parsing**: Upload a PDF resume (parsed with `pdf-parse`) or provide a quick self-description instead
- 🤖 **AI-Generated Interview Report**: Powered by Google Gemini, returns:
  - Match score (0–100) against the job description
  - Technical questions with interviewer intention + model answers
  - Behavioral questions with interviewer intention + model answers
  - Skill gap analysis with severity levels
  - Day-wise preparation roadmap with focus areas and tasks
- 📥 **Tailored Resume PDF**: Generates a job-specific, ATS-friendly resume as a downloadable PDF (via Puppeteer)
- 🗂️ **Report History**: View all previously generated interview reports
## Tech Stack
 
**Frontend**
 
- React 19 + Vite
- React Router v7
- Axios
- Sass (SCSS)
**Backend**
 
- Node.js + Express 5
- TypeScript (migration in progress)
- MongoDB + Mongoose
- JWT (`jsonwebtoken`) + `bcryptjs` for authentication
- Multer for file uploads
- `pdf-parse` for resume text extraction
- Google Gemini (`@google/genai`) for AI generation
- Zod + `zod-to-json-schema` for structured AI response schemas
- Puppeteer for HTML-to-PDF resume generation
## Project Structure
 
```
AI-Powered-Interview-Preparation-Platform/
├── Backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts        # Entry point
│       ├── app.js           # Express app (being migrated to TypeScript)
│       ├── config/          # Database connection
│       ├── controllers/     # Auth & interview controllers
│       ├── middlewares/     # Auth guard & file upload
│       ├── models/          # User, InterviewReport, BlacklistToken
│       ├── routes/          # Auth & interview routes
│       ├── services/        # Gemini AI integration
│       └── types/           # Shared TypeScript type declarations
└── Frontend/
    └── src/
        ├── app.routes.jsx
        ├── features/
        │   ├── auth/         # Login, Register, auth context/hooks
        │   └── interview/    # Home, Interview report pages, context/hooks
        └── style/
```
 
## Getting Started
 
### Prerequisites
 
- Node.js (v18+ recommended)
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))
### 1. Clone the repo
 
```bash
git clone https://github.com/Shovan05/AI-Powered-Interview-Preparation-Platform.git
cd AI-Powered-Interview-Preparation-Platform
```
 
### 2. Backend setup
 
```bash
cd Backend
npm install
```
 
> `npm install` also downloads Chromium for Puppeteer (used for PDF generation), so the first install can take a few minutes.
 
Create a `.env` file in `Backend/`:
 
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_GENAI_API_KEY=your_gemini_api_key
```
 
Run the backend:
 
```bash
npm run dev      # development: tsx with auto-restart
npm run build    # compile TypeScript to dist/
npm start        # run the compiled build
```
 
The server runs on `http://localhost:3000`.
 
### 3. Frontend setup
 
```bash
cd Frontend
npm install
```
 
Create a `.env` file in `Frontend/`:
 
```
VITE_API_URL=http://localhost:3000
```
 
Run the frontend:
 
```bash
npm run dev
```
 
The app runs on `http://localhost:5173`.
 
### Environment variables
 
| Variable | Where | Required | Purpose |
| --- | --- | --- | --- |
| `MONGO_URI` | Backend | Yes | MongoDB connection string |
| `JWT_SECRET` | Backend | Yes | Secret used to sign auth tokens |
| `GOOGLE_GENAI_API_KEY` | Backend | Yes | Google Gemini API key |
| `PORT` | Backend | No | Server port (defaults to `3000`) |
| `VITE_API_URL` | Frontend | Yes | Base URL of the backend API |
 
## API Overview
 
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/logout` | Logout & blacklist token | Public |
| GET | `/api/auth/get-me` | Get current logged-in user | Private |
| POST | `/api/interview/` | Generate a new interview report | Private |
| GET | `/api/interview/` | Get all interview reports | Private |
| GET | `/api/interview/report/:interviewId` | Get a specific interview report | Private |
| POST | `/api/interview/resume/pdf/:interviewReportId` | Generate tailored resume PDF | Private |
 
## Troubleshooting
 
**`querySrv ECONNREFUSED` when the backend connects to MongoDB Atlas**
 
- Free Atlas clusters pause after a period of inactivity. Open Atlas and resume the cluster, then restart the backend (it only tries to connect once at startup).
- Some networks (campus, office, some routers) cannot resolve the SRV records Atlas uses. In development the server uses public DNS servers to work around this; if you still see the error, try another network or use the non-SRV (`mongodb://`) connection string from Atlas.
**Login or any API call returns `404` in development**
 
- `Frontend/.env` is missing or `VITE_API_URL` is wrong. Create it as shown above and restart the frontend (Vite reads `.env` only at startup).
**`npm install` fails while downloading Chromium**
 
- Delete `node_modules` and the Puppeteer cache (`~/.cache/puppeteer`), then reinstall. To skip the download for now, set `PUPPETEER_SKIP_DOWNLOAD=true`. Resume PDF generation will not work until Chromium is installed (`npx puppeteer browsers install chrome`).
## Roadmap
 
- [ ] Migrate backend to TypeScript (done: config, models, middleware, controllers, AI service; remaining: routes and app)
- [ ] Unit and integration tests (Jest + Supertest)
- [ ] Redis: token blacklist with TTL, report caching, rate limiting
- [ ] Background job queue (BullMQ) for AI report and PDF generation
- [ ] PostgreSQL for users and report metadata
- [ ] Docker + docker-compose
- [ ] CI with GitHub Actions (lint, test, build)
- [ ] Deploy backend with environment-based config
- [ ] OpenAPI/Swagger documentation
- [ ] DOCX resume parsing support
- [ ] Password reset flow
## License
 
This project is licensed under the MIT License.
 
## Contributing
 
Contributions, issues, and feature requests are welcome. Feel free to open a PR or issue.