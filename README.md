# Virtual Podcast Studio

A modern web application for discovering and analyzing research papers from arXiv to create AI-powered podcast content.

## 🚀 Quick Start

### Backend (FastAPI)

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Next.js)

```bash
cd podcast-studio
npm run dev
```

Visit `http://localhost:3000` to use the application.

## ✨ Features

- **Multi-Topic Selection**: Choose from 8 research categories (AI, Physics, Math, etc.)
- **Real-time arXiv Integration**: Fetch latest research papers directly from arXiv
- **Clean Dark UI**: Professional GarageBand-inspired design
- **Fast API**: Efficient FastAPI backend with validation and error handling

## 🏗️ Architecture

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI with arXiv API integration
- **API**: RESTful endpoints with CORS support

## 📡 API Endpoints

- `GET /health` - Health check
- `POST /api/papers` - Fetch papers from arXiv

  ```json
  {
    "topics": ["cs.AI", "cs.CV"]
  }
  ```

## 🎯 Available Topics

- `cs.AI` - Artificial Intelligence
- `cs.LG` - Machine Learning
- `cs.CV` - Computer Vision
- `cs.RO` - Robotics

## 🔧 Development

```bash
# Frontend
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Code linting

# Backend
uvicorn main:app --reload    # Development server
```

## 📄 License

MIT License
