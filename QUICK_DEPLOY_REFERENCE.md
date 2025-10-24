# Archived: 🚀 Quick Deployment Reference (Project is Vercel-only)

This document referenced Railway-based steps which are now deprecated. Use `DEPLOYMENT_GUIDE.md` and `DEPLOYMENT_QUICK_START.md` for Vercel-only flows.

## Backend Status: ✅ LIVE on Railway

**URL:** https://brave-liberation-production-558f.up.railway.app

### Critical Next Steps

1. **Set OpenAI API Key** (Required!)
   ```powershell
   cd backend
   railway variables --set "OPENAI_API_KEY=sk-your-actual-openai-key"
   ```

2. **Deploy Frontend** (Choose one)
   ```powershell
   # Option A: Quick deploy to Vercel
   .\deploy-frontend-vercel.ps1
   
   # Option B: Manual Vercel
   npm install -g vercel
   cd frontend
   vercel
   ```

3. **Update Backend CORS** (After frontend deployed)
   ```powershell
   cd backend
   railway variables --set "BACKEND_CORS_ORIGINS=https://your-frontend-url.vercel.app"
   ```

## Quick Commands

### Backend (Railway)
```powershell
cd backend

# View logs
railway logs

# View variables
railway variables

# Set variable
railway variables --set "KEY=value"

# Deploy
railway up
```

### Frontend (Vercel)
```powershell
cd frontend

# Deploy
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls
```

## Test Your Deployment

```powershell
# Test backend health
curl https://brave-liberation-production-558f.up.railway.app/health

# Test backend API
curl https://brave-liberation-production-558f.up.railway.app/api/conversations
```

## Files Changed

✅ `backend/Dockerfile` - Fixed bundling and content copying
✅ `backend/tsup.config.ts` - Fixed external dependencies
✅ `frontend/Dockerfile` - Added scripts directory for animation scanning
✅ `RAILWAY_DEPLOYMENT_GUIDE.md` - Complete deployment guide
✅ `deploy-frontend-vercel.ps1` - Automated frontend deployment script

## What Was Fixed

1. **Docker Build Issues**
   - Removed problematic `src/sps/data` copy
   - Added `src/sps/content` for runtime scenarios
   - Changed from `npm ci` to `npm install` for Railway compatibility

2. **Bundling Issues**
   - Fixed tsup to exclude Node.js built-ins
   - Prevented "Dynamic require" errors
   - Externalized dotenv and other problematic deps

3. **Frontend Build Issues**
   - Added scripts directory for animation scanning
   - Ensured prebuild hooks work correctly

## Current Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (Deploy to Vercel)         │
│  React + Vite + Three.js + Socket.IO        │
│  https://your-app.vercel.app                │
└─────────────────┬───────────────────────────┘
                  │
                  │ WebSocket + REST API
                  │
┌─────────────────▼───────────────────────────┐
│      Backend (✅ Live on Railway)           │
│  Node.js + Express + Socket.IO              │
│  https://brave-liberation...railway.app     │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
┌────────▼────────┐ ┌─────▼──────┐
│  Azure MySQL    │ │ Azure Redis│
│  (Connected)    │ │ (Connected)│
└─────────────────┘ └────────────┘
```

## Estimated Monthly Costs

- **Railway Backend**: $3-5/month
- **Vercel Frontend**: Free (Hobby tier)
- **Total**: ~$3-5/month

## Support & Documentation

- Full Guide: `RAILWAY_DEPLOYMENT_GUIDE.md`
- Railway Dashboard: https://railway.app/project/96d001e2-c5df-4800-985a-50315b93d106
- Railway Docs: https://docs.railway.app/
- Vercel Docs: https://vercel.com/docs

## Troubleshooting

**Backend not responding?**
- Check Railway logs: `railway logs`
- Verify OpenAI API key is set
- Check Azure MySQL/Redis connections

**Frontend can't connect to backend?**
- Verify `VITE_API_BASE_URL` is correct
- Update backend CORS with frontend URL
- Check browser console for errors

**Build failing?**
- Check Railway build logs
- Verify all dependencies in package.json
- Ensure Dockerfile is correct
