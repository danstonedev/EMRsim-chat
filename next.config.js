/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	
	// GitHub Pages deployment configuration
	...(process.env.NODE_ENV === 'production' && {
		output: 'export',
		trailingSlash: true,
		basePath: '/EMRsim-chat',
		assetPrefix: '/EMRsim-chat/',
		images: {
			unoptimized: true, // GitHub Pages doesn't support Next.js Image Optimization
		},
	}),
	
	// Development optimizations
	experimental: {
		// Enable SWC minify for faster builds
		swcMinify: true,
	},
	
	// Development server configuration
	...(process.env.NODE_ENV === 'development' && {
		// Enable source maps for better debugging
		devIndicators: {
			buildActivity: true,
			buildActivityPosition: 'bottom-right',
		},
		
		// Optimize for local development
		onDemandEntries: {
			// Keep pages in memory longer for better development experience
			maxInactiveAge: 25 * 1000,
			pagesBufferLength: 5,
		},
	}),
	
	async rewrites() {
		return [
			{ source: '/favicon.ico', destination: '/favicon.svg' },
		]
	},
}

module.exports = nextConfig