# Vercel Deployment Status

## ✅ Current Production Setup

**Backend (Vercel):**
- URL: `https://backend-kncbjrapb-dan-stones-projects-04854ae1.vercel.app`
- Deployment Method: Vercel CLI / GitHub integration
- Configuration: `backend/vercel.json`

**Frontend (Vercel):**
- URL: `https://frontend-3tnjvg0e2-dan-stones-projects-04854ae1.vercel.app`
- Deployment Method: Vercel CLI / GitHub integration
- Environment Variable: `VITE_API_BASE_URL` set in `frontend/.env.production`

## 🔧 Configuration Files

### Backend
- **vercel.json**: Routes all traffic through serverless function
- **.env**: Local development configuration
- **Vercel Environment Variables**: Set in Vercel dashboard
   - `OPENAI_API_KEY`
   - `FRONTEND_ORIGIN`
   - `CORS_ALLOWED_ORIGINS`
   - Feature flags

### Frontend
- **.env.production**: Points to Vercel backend URL
- **No vercel.json**: Uses Vite's default static site build

## ⚠️ Files NOT Used for Vercel

### Docker Files (For Local Development Only)
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`

**Purpose**: Local containerized development environment
**Impact on Vercel**: None - Vercel builds from source code

### Infrastructure Directory (Azure-specific)
- `infrastructure/*.bicep`

**Purpose**: Azure infrastructure as code
**Impact on Vercel**: None - Not used for Vercel deployment

### GitHub Workflows
- `.github/workflows/cd.yml.disabled` - Azure deployment (disabled)
- `.github/workflows/ci.yml` - CI checks (still active)
- `.github/workflows/frontend-ci.yml` - Frontend tests (still active)

## 🚀 Deployment Process

### Backend
```powershell
cd backend
vercel --prod
```

### Frontend
```powershell
cd frontend
vercel --prod
```

### Environment Variables

**Backend (Set in Vercel Dashboard):**
```bash
OPENAI_API_KEY=<your-key>
OPENAI_REALTIME_MODEL=gpt-realtime-mini-2025-10-06
OPENAI_TEXT_MODEL=gpt-4o
OPENAI_TTS_VOICE=cedar
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
REALTIME_VAD_THRESHOLD=0.30
REALTIME_VAD_PREFIX_MS=300
REALTIME_VAD_SILENCE_MS=400
VOICE_ENABLED=true
SPS_ENABLED=true
VOICE_DEBUG=false
BANNERS_ENABLED=true
FRONTEND_ORIGIN=https://frontend-3tnjvg0e2-dan-stones-projects-04854ae1.vercel.app
CORS_ALLOWED_ORIGINS=https://frontend-3tnjvg0e2-dan-stones-projects-04854ae1.vercel.app
DATABASE_URL=file:./dev.db
NODE_ENV=production
```

**Frontend (Set in Vercel Dashboard or .env.production):**
```bash
VITE_API_BASE_URL=https://backend-kncbjrapb-dan-stones-projects-04854ae1.vercel.app
```

## 🔍 Verification

### Check Backend
```powershell
curl https://backend-kncbjrapb-dan-stones-projects-04854ae1.vercel.app/health
```

### Check Frontend
```powershell
curl https://frontend-3tnjvg0e2-dan-stones-projects-04854ae1.vercel.app
```

## 📝 Documentation Files

### Vercel-Focused (Current)
- `DEPLOYMENT_GUIDE.md` - Main deployment guide
- `DEPLOYMENT_QUICK_START.md` - Quick start for Vercel
- `PRODUCTION_START_GUIDE.md` - Production environment setup
- `FRONTEND_DEPLOYMENT_OPTIONS.md` - Frontend deployment options

### Historical/Alternative (Reference Only)
- `AZURE_*.md` - Azure deployment documentation (historical)
- `DEPLOYMENT_OPTIONS.md` - Compares different platforms
- `docker-compose*.yml` - Local development setup

## ✅ Clean Deployment Checklist

- [x] Vercel backend deployed
- [x] Vercel frontend deployed
- [x] Backend CORS configured for frontend URL
- [x] Frontend .env.production points to backend
- [x] Azure CD workflow disabled
- [x] Docker files documented as dev-only
- [x] Environment variables set in Vercel dashboard

## 🔄 Update URLs

When you get new Vercel deployment URLs:

1. **Update Backend CORS**:
   - Vercel Dashboard → Backend Project → Settings → Environment Variables
   - Update `FRONTEND_ORIGIN` and `CORS_ALLOWED_ORIGINS`
   - Redeploy backend

2. **Update Frontend API URL**:
   - Update `frontend/.env.production`
   - Or set `VITE_API_BASE_URL` in Vercel Dashboard
   - Redeploy frontend

## 🎯 Production Readiness

- ✅ Backend serverless on Vercel
- ✅ Frontend static site on Vercel
- ✅ CORS configured
- ✅ Environment variables secure in Vercel
- ✅ No conflicting deployment configs
- ✅ Documentation updated

---

**Last Updated**: October 24, 2025
**Deployment Method**: Vercel Only

## Latest Production URLs (2025-10-24)

- Backend: `https://backend-kncbjrapb-dan-stones-projects-04854ae1.vercel.app`
- Frontend: `https://frontend-3tnjvg0e2-dan-stones-projects-04854ae1.vercel.app`

Reminder:
 
- Set `VITE_API_BASE_URL` (frontend → Production) to the backend URL above.
- Ensure backend CORS envs allow the current frontend domain (`FRONTEND_URL`, `BACKEND_CORS_ORIGINS`).
 
