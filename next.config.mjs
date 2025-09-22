/** @type {import('next').NextConfig} */
const nextConfig = {
	async rewrites() {
		return [
			{ source: '/favicon.ico', destination: '/favicon.svg' },
		]
	},
};

export default nextConfig;
