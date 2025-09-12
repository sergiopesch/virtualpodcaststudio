# UI Components Agent Guide

## 🎯 Purpose

Reusable UI components built with Shadcn/UI and Radix UI primitives for the Virtual Podcast Studio application. These components support the complete podcast production pipeline from Research Hub to Audio Studio, Video Studio, and Publisher phases.

## 📁 File Structure

```text
src/components/ui/
├── button.tsx           # Button component
├── card.tsx             # Card component
├── checkbox.tsx         # Checkbox component
├── scroll-area.tsx      # Scrollable area component
└── AGENT.md             # This file
```

## 🎨 Component Overview

### Button (`button.tsx`)

- **Purpose**: Primary and secondary action buttons
- **Variants**: Default, outline, ghost, link
- **Sizes**: Default, sm, lg, icon
- **Usage**: Fetch Papers, Clear Selection buttons

### Card (`card.tsx`)

- **Purpose**: Container for paper information
- **Components**: Card, CardHeader, CardContent, CardFooter
- **Usage**: Paper display cards with hover effects

### Checkbox (`checkbox.tsx`)

- **Purpose**: Topic selection checkboxes
- **Features**: Controlled state, accessibility
- **Usage**: Topic selection grid

### ScrollArea (`scroll-area.tsx`)

- **Purpose**: Scrollable container for paper list
- **Features**: Custom scrollbar, smooth scrolling
- **Usage**: Paper preview section

## 🎨 Styling System

### Design Tokens

- **Colors**: Gray palette (900, 800, 700, 600, 500, 400, 300)
- **Spacing**: Tailwind spacing scale
- **Typography**: Inter font family
- **Shadows**: Subtle shadows for depth

### Component Variants

- **Primary**: Blue buttons (`bg-blue-600`)
- **Secondary**: Gray outline buttons (`border-gray-500`)
- **Cards**: Dark cards (`bg-gray-700`) with hover (`hover:bg-gray-600`)

## 🔧 Usage Examples

### Button Usage

```tsx
// Primary button
<Button className="bg-blue-600 hover:bg-blue-700">
  Fetch Papers
</Button>

// Outline button
<Button variant="outline" className="border-gray-500">
  Clear Selection
</Button>
```

### Card Usage

```tsx
<Card className="bg-gray-700 border-gray-600 hover:bg-gray-600">
  <CardContent>
    <h3>{paper.title}</h3>
    <p>{paper.authors}</p>
  </CardContent>
</Card>
```

### Checkbox Usage

```tsx
<Checkbox
  id={topic.id}
  checked={selectedTopics.includes(topic.id)}
  onCheckedChange={() => handleTopicToggle(topic.id)}
/>
```

## 🛠️ Development Notes

### Shadcn/UI Integration

- **Installation**: `npx shadcn-ui@latest add [component]`
- **Customization**: Modify component files directly
- **Styling**: Use Tailwind CSS classes
- **Accessibility**: Built-in ARIA attributes

### Component Patterns

- **Composition**: Use compound components (Card + CardContent)
- **Variants**: Use variant prop for different styles
- **Forwarding**: Forward refs for proper DOM access
- **TypeScript**: Full type safety with proper interfaces

## 🐛 Common Issues

### Styling Conflicts

- **Problem**: Tailwind classes not applying
- **Solution**: Check CSS import order
- **Debug**: Use browser dev tools

### Accessibility Issues

- **Problem**: Missing ARIA attributes
- **Solution**: Use Radix UI primitives
- **Test**: Use screen reader testing

### TypeScript Errors

- **Problem**: Type mismatches
- **Solution**: Check component prop types
- **Debug**: Use TypeScript compiler

## 🔍 Testing

### Component Testing

- **Visual**: Test in browser
- **Accessibility**: Use screen reader
- **Responsive**: Test on different screen sizes
- **Interaction**: Test hover/focus states

### Integration Testing

- **State**: Test with React state
- **Props**: Test different prop combinations
- **Events**: Test click handlers

## 📝 When Modifying

### Adding New Components

1. Use `npx shadcn-ui@latest add [component]`
2. Customize styling as needed
3. Test accessibility
4. Document usage

### Modifying Existing Components

1. Update component file
2. Test all usage locations
3. Ensure backward compatibility
4. Update documentation

### Styling Changes

1. Modify Tailwind classes
2. Test responsive design
3. Ensure contrast ratios
4. Test dark theme

## 🎯 Agent Instructions

- Always test components in isolation
- Maintain accessibility standards
- Use consistent styling patterns
- Follow Shadcn/UI conventions
- Test responsive behavior
- Document component APIs
- Ensure TypeScript compliance
