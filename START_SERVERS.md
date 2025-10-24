# EMRsim-chat Server Startup Guide

This document provides instructions for starting the development servers for the EMRsim-chat application.

## Prerequisites

- Node.js (v14.x or later recommended)
- npm or yarn package manager
- All dependencies installed (`npm install` or `yarn` should be run first)

## Starting the Frontend Development Server

The frontend server runs your React application with the optimized 3D viewer and chat components.

```bash
# Navigate to the project root
cd c:\Users\danst\EMRsim-chat

# Using npm
npm start

# OR using yarn
yarn start
```

This will start the development server on [http://localhost:3000](http://localhost:3000) by default.

## Starting the Backend Server

The backend server handles Socket.IO connections, voice transcription, and API requests.

```bash
# Navigate to the project root
cd c:\Users\danst\EMRsim-chat

# Using npm
npm run start:backend

# OR using yarn
yarn start:backend
```

If your backend is in a separate directory:

```bash
# Navigate to the backend directory
cd c:\Users\danst\EMRsim-chat\backend

# Using npm
npm start

# OR using yarn
yarn start
```

The backend server typically runs on [http://localhost:3002](http://localhost:3002).

## Starting Both Servers Simultaneously

For convenience, you can start both servers at once if you've configured it in your package.json:

```bash
# Using npm
npm run dev

# OR using yarn
yarn dev
```

## Environment Configuration

Make sure your environment variables are properly set up:

1. Check that `.env` file exists in the project root
2. Verify the following settings:
   - `REACT_APP_API_URL` - Points to your backend server
   - `REACT_APP_SOCKET_URL` - Socket.IO endpoint

## Verifying the Servers are Running

### Frontend Verification

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. You should see the EMRsim-chat interface with both 3D viewer and chat components
3. The 3D model should load and animate

### Backend Verification

1. Open [http://localhost:3002/api/health](http://localhost:3002/api/health) in your browser
2. You should see a JSON response indicating the server is healthy
3. Check console logs for successful Socket.IO connection initialization

## Troubleshooting

### Frontend Issues

- **3D Models Not Loading**:
  - Check browser console for CORS errors
  - Verify model paths in ThreeDViewerContainer.jsx
  - Check that models are in the correct public directory

- **WebSocket Connection Failed**:
  - Verify backend server is running
  - Check Socket.IO URL configuration
  - Look for CORS issues in browser console

- **Performance Problems**:
  - Verify the segregation is working (check for "Low Power Mode" indicator)
  - Open browser dev tools and check for React rendering issues
  - Monitor CPU/GPU usage

### Backend Issues

- **Server Won't Start**:
  - Check for port conflicts (default 3002)
  - Verify all dependencies are installed
  - Check for syntax errors in recent changes

- **Socket.IO Connection Issues**:
  - Check CORS configuration in backend server
  - Verify client and server Socket.IO versions are compatible
  - Check for network/firewall issues

## Development Workflow

1. Start both servers as described above
2. Make changes to frontend code - changes will automatically reload
3. For backend changes, you may need to restart the server unless you're using nodemon

## Production Deployment

For production deployment, follow different steps:

1. Build the frontend: `npm run build` or `yarn build`
2. Configure backend for production
3. Deploy to your hosting environment

Refer to DEPLOYMENT.md for detailed production deployment instructions.
