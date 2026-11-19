# LearnSphere – Smart Learning Management System with Live Classes

MERN-stack LMS (courses, video lessons, live classes, quizzes, certificates, instructor earnings).

## Status
- Stage 1: architecture and plan ✅
- Stage 2: frontend foundation (client/) ✅
- Stage 3: backend setup (server/) ✅
- Stage 4+: authentication, courses, video, quizzes, live classes... upcoming

## Run the client
```powershell
cd client
npm install
npm run dev
```
Open http://localhost:5173

## Run the server
```powershell
cd server
npm install
Copy-Item .env.example .env   # then edit MONGO_URI if needed
npm run dev
```
Check http://localhost:5000/api/health
