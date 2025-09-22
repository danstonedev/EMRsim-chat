<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Chatbot Web App - Copilot Instructions

This is a Next.js-based chatbot web application with the following key characteristics:

## Project Structure

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Main Component**: `ChatInterface.tsx` - handles the chat UI and message state
- **Layout**: Dark/light mode support with responsive design

## Development Guidelines

- Use TypeScript for all new files
- Follow React functional component patterns with hooks
- Implement responsive design with Tailwind CSS classes
- Maintain the existing chat message structure and interface

## Key Features

- Real-time chat interface with message history
- Responsive design for mobile and desktop
- Dark mode support
- Message timestamps
- Demo bot responses (ready for AI integration)

## Extension Points

- Add AI service integration in `handleSendMessage` function
- Extend message types for multimedia content
- Add user authentication
- Implement message persistence
- Add typing indicators and message status

When helping with this project, focus on maintaining the existing patterns and enhancing the chatbot functionality.
