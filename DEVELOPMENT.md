# Local Development Setup Guide

This document provides comprehensive instructions for setting up and optimizing the local development environment for the EMRsim-chat application.

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to http://localhost:3001

## Development Scripts

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Standard development server with hot reload      |
| `npm run dev:turbo`     | Development server with Turbo mode (faster)      |
| `npm run dev:inspect`   | Development server with Node.js debugging        |
| `npm run build`         | Production build                                 |
| `npm run build:analyze` | Build with bundle analysis                       |
| `npm run start`         | Start production server                          |
| `npm run start:prod`    | Start production server with NODE_ENV=production |
| `npm run lint`          | Run ESLint                                       |
| `npm run lint:fix`      | Run ESLint with auto-fix                         |
| `npm run test`          | Run tests                                        |
| `npm run test:watch`    | Run tests in watch mode                          |
| `npm run clean`         | Clean build artifacts                            |
| `npm run type-check`    | TypeScript type checking                         |

## Hot Reload Features

### ✅ What's Working

- **Component Hot Reload**: Changes to React components update instantly
- **API Route Hot Reload**: Changes to API routes in `src/app/api/` update automatically
- **Style Hot Reload**: CSS and Tailwind changes apply immediately
- **TypeScript Compilation**: Fast incremental compilation with type checking
- **Source Maps**: Full debugging support with source maps

### 🔧 Optimizations Applied

- **SWC Minification**: Faster builds using SWC instead of Terser
- **Build Activity Indicators**: Visual feedback for compilation status
- **Optimized Memory Usage**: Pages kept in memory longer for better performance
- **Fast Refresh**: React Fast Refresh enabled for instant component updates

## Development Server Configuration

### Port Configuration

- **Default Port**: 3001
- **Localhost**: http://localhost:3001
- **Network Access**: Available on local network IP (shown in terminal)

### Environment Detection

- **Development Mode**: Automatic detection via NODE_ENV
- **Environment Files**: Supports .env.local for local overrides
- **API Base URL**: Configurable via NEXT_PUBLIC_API_BASE_URL

## API Routes Testing

All API routes are available during development:

- **Chat API**: `POST http://localhost:3001/api/chat`
- **Faculty Settings**: `GET/POST http://localhost:3001/api/faculty/settings`
- **Transcribe**: `POST http://localhost:3001/api/transcribe`
- **Text-to-Speech**: `POST http://localhost:3001/api/tts`

Test with curl:

```bash
curl http://localhost:3001/api/faculty/settings
```

## Debugging

### Browser DevTools

- Source maps are enabled for debugging TypeScript in browser
- React DevTools extension recommended
- Network tab shows API requests to localhost endpoints

### Node.js Debugging

```bash
npm run dev:inspect
```

Then connect Chrome DevTools to `chrome://inspect`

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Next.js",
  "program": "${workspaceFolder}/node_modules/.bin/next",
  "args": ["dev", "-p", "3001"],
  "console": "integratedTerminal",
  "serverReadyAction": {
    "pattern": "- Local:.*https?://localhost:([0-9]+)",
    "uriFormat": "http://localhost:%s",
    "action": "openExternally"
  }
}
```

## Common Development Workflows

### Making Changes

1. **Component Changes**: Edit files in `src/components/` - see instant updates
2. **Page Changes**: Edit files in `src/app/` - automatic recompilation
3. **API Changes**: Edit files in `src/app/api/` - server restarts automatically
4. **Style Changes**: Edit CSS/Tailwind - styles update immediately

### Testing Changes

1. **Component Testing**: Changes reflect immediately in browser
2. **API Testing**: Use browser network tab or curl commands
3. **Type Checking**: Run `npm run type-check` for TypeScript validation

### Performance Monitoring

- **Build Activity**: Shows in bottom-right corner during development
- **Compilation Time**: Displayed in terminal
- **Module Count**: Shows number of modules compiled

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3001
npx kill-port 3001
# Or use different port
npm run dev -- -p 3002
```

### Slow Hot Reload

1. Check for large files in pages directory
2. Use `npm run clean` to clear build cache
3. Restart development server
4. Try `npm run dev:turbo` for faster compilation

### TypeScript Errors

```bash
# Check for type errors
npm run type-check
# Auto-fix linting issues
npm run lint:fix
```

### Environment Variables Not Loading

1. Ensure `.env.local` exists and has correct format
2. Restart development server after changes
3. Check that variables start with `NEXT_PUBLIC_` for client-side access

## Performance Tips

1. **Use Fast Refresh**: Keep components pure for better hot reload
2. **Minimize Bundle Size**: Check with `npm run build:analyze`
3. **Optimize Images**: Use Next.js Image component
4. **Cache API Responses**: Implement proper caching strategies
5. **Monitor Memory**: Use Chrome DevTools Performance tab

## Next Steps

- Consider adding Storybook for component development
- Set up end-to-end testing with Playwright or Cypress
- Add bundle analyzer for production optimization
- Consider adding error monitoring (Sentry, LogRocket)
