/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  reactStrictMode: true,

  // GitHub Pages deployment configuration
  ...(process.env.NODE_ENV === "production" && {
    output: "export",
    trailingSlash: true,
    basePath: "/EMRsim-chat",
    assetPrefix: "/EMRsim-chat/",
    images: {
      unoptimized: true, // GitHub Pages doesn't support Next.js Image Optimization
    },
  }),

  // Development optimizations with performance enhancements
  experimental: {
    // Remove deprecated swcMinify (now enabled by default in Next.js 15)
    optimizeCss: true,
    scrollRestoration: true,
    // Modern package optimization
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },

  // Performance optimizations for all environments
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression

  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Enhanced webpack optimizations for ultra-performance
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      // Advanced bundle splitting for maximum caching efficiency
      config.optimization.splitChunks = {
        chunks: "all",
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        cacheGroups: {
          // Core vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          // MUI components (heavy library)
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: "mui",
            chunks: "all",
            priority: 20,
          },
          // React ecosystem
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: "react",
            chunks: "all",
            priority: 30,
          },
          // Audio processing components
          conversation: {
            test: /[\\/]src[\\/]components[\\/].*[Cc]onversation/,
            name: "conversation",
            chunks: "async",
            priority: 5,
          },
          // Voice processing utilities
          voice: {
            test: /[\\/]src[\\/]lib[\\/](audio|hooks)[\\/]/,
            name: "voice",
            chunks: "async",
            priority: 5,
          },
          // Common utilities
          common: {
            name: "common",
            minChunks: 2,
            priority: -10,
            reuseExistingChunk: true,
          },
        },
      };

      // Optimize for production builds
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    return config;
  },

  // Development server configuration
  ...(process.env.NODE_ENV === "development" && {
    // Enable source maps for better debugging
    devIndicators: {
      position: "bottom-right",
    },

    // Optimize for local development
    onDemandEntries: {
      // Keep pages in memory longer for better development experience
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 5,
    },
  }),

  async rewrites() {
    // Only apply rewrites in development (not for static export)
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/favicon.ico", destination: "/favicon.svg" },
        // Silence missing legacy image requests during dev
        {
          source: "/img/EMRsim-chat_white.png",
          destination: "/favicon.svg",
        },
      ];
    }
    return [];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
