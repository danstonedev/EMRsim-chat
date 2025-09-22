/** @type {import('next').NextConfig} */
const nextConfig = {
	devIndicators: {
		// Hide the circular Next.js build activity indicator in dev
		buildActivity: false,
	},
	async rewrites() {
		return [
			{ source: '/favicon.ico', destination: '/favicon.svg' },
		]
	},
};

export default nextConfig;
