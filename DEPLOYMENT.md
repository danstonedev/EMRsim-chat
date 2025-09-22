# GitHub Pages Deployment Guide

This app has been configured to deploy to GitHub Pages, but requires external API services since GitHub Pages only supports static hosting.

## Current Status

✅ **Static Site Configuration**: Next.js is configured for static export
✅ **GitHub Actions**: Automated deployment workflow is set up
⚠️ **API Services Required**: You need to deploy API endpoints externally

## API Endpoints That Need External Hosting

The app uses these API endpoints that won't work on GitHub Pages:

- `/api/chat` - OpenAI chat completions
- `/api/transcribe` - Speech-to-text using OpenAI Whisper
- `/api/tts` - Text-to-speech using OpenAI TTS
- `/api/faculty/settings` - Faculty configuration

## Deployment Options

### Option 1: Deploy APIs to Vercel (Recommended)

1. **Create a new Vercel project for APIs only**:
   ```bash
   # Create a new directory for your API service
   mkdir emrsim-api
   cd emrsim-api
   npm init -y
   npm install next openai
   ```

2. **Copy your API routes**:
   - Copy `src/app/api/*` to your new Vercel project
   - Copy `src/lib/prompts/*` and `src/lib/config/faculty.ts`

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

4. **Update environment variables**:
   - Create `.env.local` with your Vercel API URL:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://your-api-service.vercel.app
   ```

### Option 2: Deploy Everything to Vercel

Simply deploy the entire app to Vercel instead of GitHub Pages:

```bash
npm install -g vercel
vercel --prod
```

### Option 3: Use External Services

Replace the API routes with direct calls to external services:
- OpenAI API directly from the client
- Third-party transcription services
- External TTS services

## Environment Variables Needed

For production deployment, you'll need:

```env
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_API_BASE_URL=https://your-api-service.vercel.app
NEXT_PUBLIC_BASE_PATH=/EMRsim-chat
```

## Testing GitHub Pages Deployment

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Test the export**:
   ```bash
   npx serve out
   ```

3. **Push to trigger GitHub Actions**:
   ```bash
   git add .
   git commit -m "Configure GitHub Pages deployment"
   git push
   ```

## Current Configuration

- ✅ `next.config.js` - Configured for static export
- ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow
- ✅ `src/lib/config/api.ts` - Environment-based API URL routing
- ✅ Updated all components to use `getApiUrl()`
- ✅ `public/.nojekyll` - Prevents Jekyll processing

The app will build and deploy to GitHub Pages, but API functionality will only work once you set up external API services.