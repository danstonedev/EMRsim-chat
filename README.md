# Chatbot Web App

A modern, responsive web-based chatbot application built with Next.js, React, and TypeScript.

## Features

- 🤖 Interactive chat interface with real-time messaging
- 🎨 Modern UI with Tailwind CSS styling
- 🌙 Dark mode support
- 📱 Responsive design for desktop and mobile
- ⚡ Built with Next.js 15 and React 19
- 🔧 TypeScript for type safety
- 🎯 Easy to extend and customize

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3001](http://localhost:3001) in your browser to see the result.

### Environment Variables

To enable real AI responses, create a `.env.local` file and set your OpenAI API key:

```powershell
copy .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY
```

Required:

- `OPENAI_API_KEY`: Your OpenAI API key. Get one from <https://platform.openai.com/>.

The server-side API route at `src/app/api/chat/route.ts` uses this key to call OpenAI.

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Project Structure

```bash
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout component
│   │   └── page.tsx         # Home page
│   └── components/
│       └── ChatInterface.tsx # Main chat component
├── .github/
│   └── copilot-instructions.md # Copilot workspace instructions
├── package.json
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── next.config.js          # Next.js configuration
```

## Chat Controls and Theming

The app includes a controls panel at the top with:

- System Prompt: a multi-line input that lets you steer the chatbot's behavior. It's saved to `localStorage` and restored on reload.
- Theme Toggle: switches between light and dark themes by toggling a `data-theme` attribute on `html`. The choice is also saved to `localStorage`.

Tip: Use the suggestion chips under the chat to quickly pre-fill common prompts.

## Customization

### Adding AI Integration

This project is wired to OpenAI Chat Completions via `/api/chat`. Steps already implemented:

1. `src/app/api/chat/route.ts` posts messages to OpenAI using `OPENAI_API_KEY`
2. `src/components/ChatInterface.tsx` calls `/api/chat` and renders the reply
3. Add your key to `.env.local` to enable it

### Styling

The app uses Tailwind CSS for styling. You can customize:

- Colors in `tailwind.config.ts`
- Global styles in `src/app/globals.css`
- Component-specific styles in the respective files

## Deployment

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com):

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

### Deploy on Other Platforms

Build the application:

```bash
npm run build
```

Then follow the deployment instructions for your preferred platform.

## Troubleshooting

- Port already in use: the dev server is configured to run on `3001`. If it's busy, stop the other process or run `npm run dev -- -p 3002`.
- Autoprefixer not found: ensure dependencies are installed with `npm install`. The project uses PostCSS with Tailwind CSS and `autoprefixer`.
- Global CSS location: Next.js App Router requires global CSS to be imported from `src/app/layout.tsx` (already set up in this repo).

## Browser compatibility notes

- Text resizing: We set `-webkit-text-size-adjust` and `text-size-adjust` on `html` to avoid unexpected zoom on mobile.
- Disable selection: Use the `.no-select` utility which includes `-webkit-user-select` for Safari and `user-select` for others.
- Hidden scrollbars: Chips scroller hides scrollbars using `::-webkit-scrollbar` (WebKit) and `scrollbar-width` (Firefox), with `-ms-overflow-style` for legacy Edge/IE.
- Dev overlay hints: Some hints (e.g., on `.dev-tools-indicator-item`) come from Next.js dev UI and can be safely ignored.
- MIME types: If you serve media or fonts later, prefer `audio/mpeg` for MP3 and `font/otf` for OTF fonts.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
