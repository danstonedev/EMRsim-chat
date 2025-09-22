// API configuration for different environments
// GitHub Pages doesn't support API routes, so we need external endpoints

const getApiUrl = (endpoint: string): string => {
  // In production (GitHub Pages), use external API URLs
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (baseUrl) {
      return `${baseUrl}${endpoint}`
    }
    // Fallback URLs - you'll need to deploy these to a serverless platform
    const fallbackUrls = {
      '/api/chat': process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://your-api-service.vercel.app/api/chat',
      '/api/transcribe': process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL || 'https://your-api-service.vercel.app/api/transcribe',
      '/api/tts': process.env.NEXT_PUBLIC_TTS_API_URL || 'https://your-api-service.vercel.app/api/tts',
      '/api/faculty/settings': process.env.NEXT_PUBLIC_API_BASE_URL ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/faculty/settings` : 'https://your-api-service.vercel.app/api/faculty/settings'
    }
    return fallbackUrls[endpoint as keyof typeof fallbackUrls] || endpoint
  }
  
  // In development, use local API routes
  return endpoint
}

export { getApiUrl }