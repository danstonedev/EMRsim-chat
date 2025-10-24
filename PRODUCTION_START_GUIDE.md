# Production Environment Start Guide

## ✅ Configuration Complete

Your frontend is now configured for Vercel deployment!

### Current Setup

**Frontend (Vercel):**
```
https://your-app.vercel.app
```

**Backend (Local Preview):**
```
http://localhost:3002
```

### Configuration Files Updated

**`frontend/.env.production`:** (for local testing)
```bash
VITE_API_BASE_URL=http://localhost:3002
```

## How to Start Production Environment

### Quick Start

```powershell
# From project root
cd frontend
npm run build    # Build with production env
npm run preview  # Start preview server on port 4173
```

### Using VS Code Tasks

Press `Ctrl+Shift+P` → "Tasks: Run Task" → "Frontend: Build" then "Frontend: Preview"

## Deployment Options

### Deploy Frontend to Vercel

1. **Build for production:**
   ```powershell
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel:**
   ```powershell
   # Install Vercel CLI if needed
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure environment variable on Vercel:**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add: `VITE_API_BASE_URL` = `https://your-backend-url.vercel.app`

### Deploy Backend to Vercel

1. **Navigate to backend:**
   ```powershell
   cd backend
   ```

2. **Deploy to Vercel:**
   ```powershell
   # Install Vercel CLI if needed
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure environment variables on Vercel:**
   - Go to Vercel dashboard → Your backend project → Settings → Environment Variables
   - Add all required variables from `.env.example`

## Testing Locally

### 1. Start Preview Server

```powershell
cd frontend
npm run preview
```

Server runs on: `http://localhost:4173`

### 2. Test API Connection

Open browser console and check network requests - they should go to:
```
http://localhost:3002
```

### 3. Verify CORS Settings

Make sure your backend allows requests from your frontend domain.

In `backend/.env` or Vercel environment variables:
```bash
CORS_ORIGIN=https://your-frontend-domain.vercel.app
# or
CORS_ORIGIN=* # For testing (not recommended for production)
```

## Troubleshooting

### Frontend can't connect to backend

**Check CORS configuration:**
```javascript
// backend/src/server.js or similar
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
```

### Backend not responding

1. Check Vercel dashboard for errors
2. View logs in Vercel dashboard
3. Verify environment variables are set

### Build fails

```powershell
# Clean and rebuild
cd frontend
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run build
```

## NPM Scripts Reference

```json
{
  "dev": "vite",                    // Development server
  "build": "vite build",            // Build for production
  "preview": "vite preview",        // Preview production build
  "type-check": "tsc --noEmit"     // Check TypeScript
}
```

## Environment Files

- `.env.local` - Development (localhost backend)
- `.env.production` - Production (Vercel backend)

Vite automatically uses `.env.production` when running `npm run build`.

## Next Steps

1. ✅ Test locally with `npm run preview`
2. 🚀 Deploy frontend to Vercel
3. 🚀 Deploy backend to Vercel
4. 🔒 Update CORS_ORIGIN on backend
5. 🧪 Test end-to-end functionality
6. 📊 Monitor Vercel logs for any issues

---

**Your production environment is ready to deploy!** 🎉
