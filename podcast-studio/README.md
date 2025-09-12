# Podcast Studio Frontend

Next.js frontend for the Virtual Podcast Studio application.

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🛠️ Tech Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn/UI** for components

## 📁 Project Structure

```text
src/
├── app/                 # Next.js App Router
│   ├── api/papers/      # API routes
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/ui/       # Reusable UI components
└── lib/                 # Utility functions
```

## 🎨 Features

- Dark theme with professional design
- Topic selection with checkboxes (AI, ML, Computer Vision, Robotics)
- Real-time paper fetching from arXiv
- Responsive design for all devices
- Error handling and loading states

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
