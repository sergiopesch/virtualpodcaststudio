# Virtual Podcast Studio - Agent Guide

## 🎯 Project Overview

This is a full-stack web application for discovering and analyzing research papers from arXiv to create AI-powered podcast content. The system consists of a FastAPI backend and Next.js frontend.

## 🏗️ Architecture Overview

```text
virtualpodcaststudio/
├── backend/           # FastAPI server (Python)
├── podcast-studio/    # Next.js frontend (TypeScript)
└── AGENT.md          # This file
```

## 🚀 Quick Start for Agents

1. **Backend**: `cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
2. **Frontend**: `cd podcast-studio && npm run dev`
3. **Access**: <http://localhost:3000>

## 🔧 Key Components

### Backend (`backend/`)

- **main.py**: FastAPI server with arXiv API integration
- **requirements.txt**: Python dependencies
- **venv/**: Virtual environment (don't modify)

### Frontend (`podcast-studio/`)

- **src/app/page.tsx**: Main UI component with topic selection and paper display
- **src/app/api/papers/route.ts**: Next.js API route that proxies to backend
- **src/components/ui/**: Reusable UI components (Button, Card, etc.)

## 🎯 Available Topics

- `cs.AI` - Artificial Intelligence
- `cs.LG` - Machine Learning  
- `cs.CV` - Computer Vision
- `cs.RO` - Robotics

## 🔄 Data Flow

1. User selects topics in frontend
2. Frontend calls `/api/papers` with selected topics
3. Next.js API route forwards request to FastAPI backend
4. Backend fetches papers from arXiv API
5. Papers are deduplicated and returned
6. Frontend displays papers in scrollable cards

## 🛠️ Development Guidelines

- **Backend**: Uses FastAPI with httpx for HTTP requests
- **Frontend**: Uses Next.js 15 with TypeScript, Tailwind CSS, Shadcn/UI
- **State Management**: React useState hooks
- **Error Handling**: Try-catch blocks with user-friendly error messages
- **Deduplication**: Both backend and frontend handle duplicate papers

## 🐛 Common Issues

- **arXiv API**: Always use HTTPS (<https://export.arxiv.org>)
- **Duplicate Keys**: Papers are deduplicated by ID to prevent React key errors
- **Font Issues**: Uses Inter font instead of Geist to avoid loading issues

## 📝 When Modifying

- **Backend changes**: Server auto-reloads with uvicorn --reload
- **Frontend changes**: Next.js hot-reloads automatically
- **API changes**: Update both frontend route.ts and backend main.py
- **UI changes**: Modify page.tsx and ensure responsive design

## 🎨 UI Patterns

- **Dark Theme**: Gray-900 background, gray-800 cards
- **Buttons**: Blue primary, gray outline secondary
- **Cards**: Hover effects with gray-600 background
- **Typography**: White text, gray-400 for secondary text
- **Layout**: Responsive grid (1 col mobile, 2 col tablet, 4 col desktop)

## 🔍 Testing

- Backend health: `curl http://localhost:8000/health`
- API test: `curl -X POST http://localhost:3000/api/papers -H "Content-Type: application/json" -d '{"topics": ["cs.AI"]}'`
- Frontend: Visit <http://localhost:3000>

## 📚 Dependencies

- **Backend**: fastapi, httpx, uvicorn, python-dotenv
- **Frontend**: next, react, typescript, tailwindcss, @radix-ui components
