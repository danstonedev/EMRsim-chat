/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	devIndicators: {
		// Hide the circular Next.js build activity indicator in dev
		buildActivity: false,
	},
};

module.exports = nextConfig;