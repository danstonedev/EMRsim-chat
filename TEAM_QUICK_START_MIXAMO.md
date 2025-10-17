# Quick Start: Adding Mixamo Models (Team Checklist)

## 🎯 Goal
Replace the simple geometric human figure with a professional animated 3D character from Mixamo in **under 2 hours**.

---

## 👥 Team Roles

### Person A: Asset Manager (30-45 min)
**Skills needed**: None (just follow steps)
**Task**: Download models and animations from Mixamo

### Person B: Developer (45-60 min)
**Skills needed**: Basic JavaScript/TypeScript
**Task**: Update code files to load new models

### Person C: Tester (15-30 min)
**Skills needed**: None
**Task**: Test functionality and report issues

---

## 📋 PERSON A: Download Assets from Mixamo

### Setup (5 minutes)
- [ ] Go to https://www.mixamo.com/
- [ ] Click "Sign In" (top right)
- [ ] Create/use Adobe account (free)
- [ ] You're now in the Mixamo dashboard

### Download Character (10 minutes)
- [ ] Click "Characters" tab
- [ ] Search for "Malcolm" (recommended) or browse others
- [ ] Click on character thumbnail to select
- [ ] Click orange "DOWNLOAD" button
- [ ] Settings:
  - Format: **FBX Binary (.fbx)** ← Select this one
  - Pose: T-Pose (default is fine)
  - Click "DOWNLOAD"
- [ ] Save file as `human-figure.fbx` to your Desktop

### Download Animations (15-20 minutes)
**For each animation below, repeat these steps:**

1. Click "Animations" tab (stay on same character!)
2. Search for animation name
3. Click animation to preview
4. Optional: Adjust with sliders (Trim, In Place, etc.)
5. Click "DOWNLOAD"
6. Settings:
   - Format: **glTF Binary (.glb)**
   - Skin: **Without Skin** ← IMPORTANT
   - Click "DOWNLOAD"
7. Save with descriptive name

**Download these 5 animations:**
- [ ] **"Idle"** → save as `idle.fbx`
- [ ] **"Walking"** → save as `walking.fbx`
  - ✅ Check "In Place" if available
- [ ] **"Running"** → save as `running.fbx`
  - ✅ Check "In Place" if available
- [ ] **"Sitting"** → save as `sitting.fbx`
- [ ] **"Waving"** → save as `waving.fbx`

### Organize Files (5 minutes)
- [ ] Create folder structure on Desktop:
  ```
  3D-Assets/
  ├── human-figure.fbx
  └── animations/
      ├── idle.fbx
      ├── walking.fbx
      ├── running.fbx
      ├── sitting.fbx
      └── waving.fbx
  ```

### Convert FBX to GLB (10 minutes)
**Option A: Online Converter (Easiest)**
- [ ] Go to: https://products.aspose.app/3d/conversion/fbx-to-glb
- [ ] Upload your `human-figure.fbx`
- [ ] Click "Convert"
- [ ] Download as `human-figure.glb`
- [ ] Repeat for all 5 animation files

**Option B: Use gltf-pipeline (if you have Node.js)**
- [ ] Open PowerShell in your 3D-Assets folder
- [ ] Run: `npm install -g fbx2gltf`
- [ ] Convert: `fbx2gltf human-figure.fbx`
- [ ] Repeat for animations

### Move to Project (5 minutes)
- [ ] Open File Explorer
- [ ] Navigate to project: `C:\Users\danst\EMRsim-chat\frontend\public\`
- [ ] Create `models` folder if it doesn't exist
- [ ] Copy converted .glb files into `frontend\public\models\`
- [ ] Final structure should be:
  ```
  frontend/public/models/
  ├── human-figure.glb
  └── animations/
      ├── idle.glb
      ├── walking.glb
      ├── running.glb
      ├── sitting.glb
      └── waving.glb
  ```

### ✅ Person A Complete!
Send message to Person B: "Assets ready in `frontend/public/models/`"

---

## 💻 PERSON B: Update Code

### Prerequisites
- [ ] Make sure frontend dev server is running
- [ ] Open VS Code
- [ ] Navigate to `frontend/src/pages/components/viewer/`

### Step 1: Update HumanFigure.tsx (15 min)
- [ ] Open `frontend/src/pages/components/viewer/HumanFigure.tsx`
- [ ] **Delete everything** in the file
- [ ] Copy this code: (see `3D_MODEL_INTEGRATION_FRAMEWORK.md` → Method 1 → Phase 3 → File 1)
- [ ] Or use GitHub Copilot: "Replace this file with code to load Mixamo GLTF models from /models/ folder with animations"
- [ ] Save file

### Step 2: Update Scene.tsx (5 min)
- [ ] Open `frontend/src/pages/components/viewer/Scene.tsx`
- [ ] Find the `<HumanFigure />` component
- [ ] Wrap it in `<Suspense>` tag with loading indicator
- [ ] See framework doc for exact code
- [ ] Save file

### Step 3: Update ViewerControls.tsx (10 min)
- [ ] Open `frontend/src/pages/components/viewer/ViewerControls.tsx`
- [ ] Add animation selector buttons
- [ ] See framework doc Section "File 4"
- [ ] Save file

### Step 4: Update Viewer3D.tsx (10 min)
- [ ] Open `frontend/src/pages/Viewer3D.tsx`
- [ ] Add `currentAnimation` state
- [ ] Add `handleAnimationChange` function
- [ ] Pass props to components
- [ ] See framework doc Section "File 2"
- [ ] Save file

### Step 5: Update Styles (5 min)
- [ ] Open `frontend/src/styles/viewer3d.css`
- [ ] Scroll to bottom
- [ ] Add animation selector styles
- [ ] Add loading spinner styles
- [ ] See framework doc Section "File 5"
- [ ] Save file

### Step 6: Check for Errors
- [ ] Look at VS Code "Problems" tab
- [ ] Fix any TypeScript errors
- [ ] Check terminal for build errors
- [ ] Hot reload should happen automatically

### ✅ Person B Complete!
Send message to Person C: "Code updated, ready for testing"

---

## 🧪 PERSON C: Test Everything

### Test 1: Page Loads
- [ ] Open browser to `http://localhost:5173/3d-viewer`
- [ ] Wait for "Loading 3D model..." message
- [ ] Character should appear within 5-10 seconds
- [ ] ❌ If stuck loading forever → tell Person B (model path issue)

### Test 2: Animations
- [ ] Click each animation button: Idle, Walking, Running, Sitting, Waving
- [ ] Character should smoothly transition between animations
- [ ] ❌ If animation doesn't play → note which one, tell Person B

### Test 3: Camera Controls
- [ ] Click and drag → character should rotate
- [ ] Scroll wheel → should zoom in/out
- [ ] Right-click drag → should pan
- [ ] ❌ If controls don't work → tell Person B

### Test 4: Playback Controls
- [ ] Click "Pause" → animation should stop
- [ ] Click "Play" → animation should resume
- [ ] Click "Reset View" → camera should return to start position
- [ ] ❌ If buttons don't work → tell Person B

### Test 5: Performance
- [ ] Open browser DevTools (F12)
- [ ] Go to "Performance" tab
- [ ] Watch FPS counter
- [ ] Should maintain 50-60 FPS
- [ ] ❌ If laggy/choppy → note it (optimization needed later)

### Test 6: Mobile (if available)
- [ ] Open on phone/tablet
- [ ] Touch and drag should rotate
- [ ] Pinch to zoom
- [ ] All buttons should work
- [ ] ❌ If doesn't work → note details

### Test 7: Navigation
- [ ] Click "X" close button
- [ ] Should return to main chat page
- [ ] Click "3D Viewer" in header
- [ ] Should return to 3D viewer
- [ ] ❌ If navigation broken → tell Person B

### Create Test Report
Document in Slack/Teams/Email:
```
✅ WORKING:
- [List what works]

❌ ISSUES:
- [List problems with details]

📱 MOBILE:
- [Tested? Works? Issues?]

⚡ PERFORMANCE:
- FPS: ~XX
- Load time: ~XX seconds
- [Smooth? Laggy?]
```

### ✅ Person C Complete!
Share test report with team

---

## 🐛 Common Issues & Fixes

### Issue: "Loading 3D model..." never finishes
**Fix**: File paths are wrong
- Check files are in `frontend/public/models/` exactly
- Check file names match code exactly (case-sensitive!)
- Open DevTools Console (F12) → look for 404 errors

### Issue: Character loads but no animation
**Fix**: Animation files not loaded
- Verify all 5 animation .glb files are in `models/animations/`
- Check console for errors
- Try clicking different animation buttons

### Issue: Character is tiny or huge
**Fix**: Scale issue
```typescript
// In HumanFigure.tsx, add scale:
<primitive object={scene.clone()} scale={[1, 1, 1]} />
// Try [0.01, 0.01, 0.01] or [100, 100, 100]
```

### Issue: Character is dark/black
**Fix**: Lighting issue
```typescript
// In Scene.tsx, increase light intensity:
<ambientLight intensity={1.5} />
<directionalLight intensity={1.5} ... />
```

### Issue: TypeScript errors
**Fix**: Type definitions
```bash
npm install --save-dev @types/three
```

---

## 📸 Success Checklist

When everything works, you should see:
- [ ] Professional 3D character (not geometric shapes)
- [ ] 5 animation buttons at bottom
- [ ] Character animates when button clicked
- [ ] Smooth camera controls
- [ ] Clean UND green styling
- [ ] Loads in under 10 seconds
- [ ] Works on mobile (if tested)

---

## 🚀 Next Steps After Success

1. **Add More Animations**
   - Go back to Mixamo
   - Download: Jumping, Crouching, Stretching, etc.
   - Follow same process

2. **Customize Character**
   - Try different characters (Kaya, Remy, etc.)
   - Mix and match for different scenarios

3. **Optimize Performance**
   - Compress models with gltf-pipeline
   - Add progress bars
   - Implement caching

4. **Medical Features**
   - Add body part labels
   - Create medical examination poses
   - Build gait analysis tools

---

## 📞 Need Help?

**Stuck on downloads?**
- Watch Mixamo tutorial: https://www.youtube.com/results?search_query=mixamo+tutorial

**Code not working?**
- Check the full framework doc: `3D_MODEL_INTEGRATION_FRAMEWORK.md`
- Use GitHub Copilot to explain errors
- Ask: "Why is this GLTF model not loading in React Three Fiber?"

**Performance issues?**
- Models might be too detailed
- Try different character from Mixamo
- Enable Draco compression (advanced)

---

**Good luck! You've got this! 🎉**

Estimated total time: **1.5 to 2 hours** for complete team
