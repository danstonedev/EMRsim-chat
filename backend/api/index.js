// Vercel serverless function wrapper
import { createApp } from '../dist/index.js';

// Create app instance
const app = createApp();

// Export for Vercel
export default app;
