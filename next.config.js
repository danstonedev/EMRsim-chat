/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	
	// Development optimizations
	experimental: {
		// Enable SWC minify for faster builds
		swcMinify: true,
		// Enable turbo mode for faster development
		turbo: {
			rules: {
				'*.svg': {
					loaders: ['@svgr/webpack'],
					as: '*.js',
				},
			},
		},
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