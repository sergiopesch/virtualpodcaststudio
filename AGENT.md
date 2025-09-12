# Virtual Podcast Studio - Agent Guide

## 🎯 Project Overview

This is a comprehensive podcast production platform that transforms research papers into AI-powered podcast content through a complete workflow: Research → Audio Studio → Video Studio → Publisher. The system consists of a FastAPI backend and Next.js frontend.

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

## 🎬 Application Workflow

### 1. Research Hub (Home Page)

- **Purpose**: Discover and analyze research papers from arXiv
- **Functionality**: Topic selection, paper fetching, content analysis
- **Output**: Curated research papers ready for podcast creation

### 2. Audio Studio (`/studio`)

- **Purpose**: Generate audio conversations between user and AI experts
- **Functionality**: AI-powered conversation recording, transcript generation
- **Output**: Audio files and conversation transcripts

### 3. Video Studio (Future)

- **Purpose**: Generate video rendering from conversation transcripts
- **Functionality**: Video production, visual effects, scene generation
- **Output**: Video files synchronized with audio

### 4. Publisher (Future)

- **Purpose**: Merge audio with video and generate final podcast files
- **Functionality**: Final production, thumbnail generation, platform export
- **Output**: Ready-to-publish podcast episodes

## 🔧 Key Components

### Backend (`backend/`)

- **main.py**: FastAPI server with arXiv API integration
- **requirements.txt**: Python dependencies
- **venv/**: Virtual environment (don't modify)

### Frontend (`podcast-studio/`)

- **src/app/page.tsx**: Research Hub with topic selection and paper display
- **src/app/studio/page.tsx**: Audio Studio for conversation recording
- **src/app/api/papers/route.ts**: Next.js API route that proxies to backend
- **src/components/ui/**: Reusable UI components (Button, Card, etc.)

## 🎯 Available Research Topics

- `cs.AI` - Artificial Intelligence
- `cs.LG` - Machine Learning  
- `cs.CV` - Computer Vision
- `cs.RO` - Robotics

## 🔄 Data Flow

1. **Research Phase**: User selects topics in Research Hub
2. **Paper Fetching**: Frontend calls `/api/papers` with selected topics
3. **Backend Processing**: Next.js API route forwards request to FastAPI backend
4. **arXiv Integration**: Backend fetches papers from arXiv API
5. **Data Processing**: Papers are deduplicated and returned
6. **Content Display**: Frontend displays papers in scrollable cards
7. **Audio Creation**: User moves to Audio Studio to create conversations
8. **Production Pipeline**: Future phases for video and publishing

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
