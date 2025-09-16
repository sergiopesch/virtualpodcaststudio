# Frontend Agent Guide

## 🎯 Purpose

Next.js frontend application that powers the Virtual Podcast Studio's complete production pipeline. It provides interfaces for Research Hub (topic selection and paper display), Audio Studio (conversation recording), Video Studio (video production), and Publisher (final production and export).

## 📁 File Structure

```text
podcast-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Research Hub (home page)
│   │   ├── studio/page.tsx       # Audio Studio
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   └── api/papers/route.ts   # API route (proxies to backend)
│   ├── components/ui/            # Reusable UI components
│   └── lib/utils.ts              # Utility functions
├── package.json                  # Dependencies
└── AGENT.md                      # This file
```

## 🎨 UI Components

### Research Hub (`src/app/page.tsx`)

- **Navigation**: Sidebar with Audio Studio, Video Studio, Publisher, and Team sections
- **Topic Selection**: Grid of clickable cards for 4 research topics (AI, ML, Computer Vision, Robotics)
- **Action Buttons**: "Start Audio Studio" and "Clear Selection"
- **Audio Handoff**: "Start Audio Studio" persists the selected paper to `sessionStorage` (`vps:selectedPaper`) before navigating to `/studio`.
- **Paper Display**: Scrollable cards showing paper details with author and publication info
- **Status Indicators**: Shows selected topics and loaded papers count

### Audio Studio (`src/app/studio/page.tsx`)

- **Navigation**: Sidebar with active state indicators
- **Conversation Interface**: Chat-like interface for AI-powered conversations
- **Recording Controls**: Play, pause, stop, and download functionality
- **Transcript Display**: Real-time conversation transcript with timestamps
- **AI Participants**: Simulated AI experts for different research topics
- **Current Paper**: Card hydrates from the Research Hub handoff, falling back to guidance copy when no paper is stored.
- **Live Badge**: Sidebar only shows the "LIVE" pill while `isRecording` is true.

### Layout (`src/app/layout.tsx`)

- **Root Layout**: HTML structure with Inter font and microphone favicon
- **Metadata**: Page title and description for podcast production
- **Global Styles**: Tailwind CSS imports with dark theme

### API Route (`src/app/api/papers/route.ts`)

- **Proxy**: Forwards requests to FastAPI backend
- **Error Handling**: Catches and formats backend errors
- **CORS**: Handles cross-origin requests

## 🎯 Available Topics

```typescript
const topics = [
  { id: "cs.AI", label: "Artificial Intelligence" },
  { id: "cs.LG", label: "Machine Learning" },
  { id: "cs.CV", label: "Computer Vision" },
  { id: "cs.RO", label: "Robotics" },
];
```

## 🔄 State Management

### React State

- **`selectedTopics`**: Array of selected topic IDs
- **`papers`**: Array of fetched papers
- **`loading`**: Boolean for loading state
- **`error`**: String for error messages

### State Updates

- **Topic Selection**: Toggle topics in/out of array
- **Paper Fetching**: Set loading, fetch data, update papers
- **Clear Selection**: Reset all state to initial values

## 🎨 Styling System

### Design System

- **Theme**: Dark theme with gray color palette
- **Background**: `bg-gray-900` (main), `bg-gray-800` (cards)
- **Text**: `text-white` (primary), `text-gray-400` (secondary)
- **Buttons**: `bg-blue-600` (primary), `border-gray-500` (outline)

### Responsive Design

- **Mobile**: Single column layout
- **Tablet**: Two column grid (`sm:grid-cols-2`)
- **Desktop**: Four column grid (`lg:grid-cols-4`)

### Component Library

- **Shadcn/UI**: Pre-built components (Button, Card, Checkbox, ScrollArea)
- **Tailwind CSS**: Utility-first styling
- **Custom Classes**: App-specific styling for podcast studio theme

## 🔧 Key Functions

### `handleTopicToggle(topicId)`

- Toggles topic selection
- Updates `selectedTopics` state
- Handles single/multiple selection

### `handleFetchPapers()`

- Validates topic selection
- Sets loading state
- Calls API endpoint
- Handles errors and success
- Deduplicates papers

### `handleClearSelection()`

- Resets all state
- Clears selected topics
- Clears loaded papers
- Clears error messages

### `handleStartAudioStudio(paper)`

- Serializes `PaperCardData` into `sessionStorage` under `vps:selectedPaper`
- Navigates to `/studio` using the Next.js router
- Logs storage failures so the Audio Studio can surface an empty-state warning

## 🛠️ Development Notes

### Dependencies

- **next**: React framework
- **react**: UI library
- **typescript**: Type safety
- **tailwindcss**: Styling
- **@radix-ui**: Component primitives

### Build System

- **Next.js 15**: Latest version with App Router
- **Turbopack**: Fast bundler for development
- **TypeScript**: Compile-time type checking

### API Integration

- **Frontend API**: `/api/papers` (Next.js route)
- **Backend API**: `http://localhost:8000/api/papers` (FastAPI)
- **Error Handling**: User-friendly error messages

## 🐛 Common Issues

### Duplicate Keys

- **Problem**: Same paper appears in multiple topics
- **Solution**: Deduplication in both frontend and backend
- **Implementation**: Filter by unique paper ID

### Font Loading

- **Problem**: Geist font causes loading issues
- **Solution**: Use Inter font instead
- **Implementation**: Updated in `layout.tsx`

### State Management

- **Problem**: State not updating correctly
- **Solution**: Use functional state updates
- **Implementation**: `setState(prev => ...)`

## 🔍 Testing

### Manual Testing

1. **Topic Selection**: Click checkboxes, verify selection
2. **Paper Fetching**: Click "Fetch Papers", verify loading state
3. **Clear Selection**: Click "Clear Selection", verify reset
4. **Error Handling**: Test with invalid topics

### API Testing

```bash
# Test frontend API
curl -X POST http://localhost:3000/api/papers \
  -H "Content-Type: application/json" \
  -d '{"topics": ["cs.AI"]}'
```

## 📝 When Modifying

### Adding New Topics

1. Update `topics` array in `page.tsx`
2. Update grid layout if needed
3. Test topic selection and API calls

### Changing UI Layout

1. Modify Tailwind classes
2. Test responsive design
3. Ensure accessibility

### Adding New Features

1. Update state management
2. Add new UI components
3. Update API integration
4. Test error handling

## 🎯 Agent Instructions

- Always test UI changes in browser
- Maintain responsive design principles
- Use TypeScript for type safety
- Follow React best practices
- Keep components small and focused
- Handle loading and error states
- Ensure accessibility compliance
