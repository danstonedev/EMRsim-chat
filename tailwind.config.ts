import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/styles/**/*.css",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
  // Ultra-aggressive CSS purging for maximum performance (Tailwind v3+ syntax)
  safelist: [
    // Essential animation classes
    "animate-pulse",
    "animate-spin",
    // Theme classes
    "dark",
    "light",
    // Conversation overlay classes
    "conversation-overlay",
    // Critical utility classes
    "sr-only",
    "focus:ring-2",
    "focus:ring-offset-2",
    // Dynamic classes used in JS
    {
      pattern:
        /^bg-(red|green|blue|gray|slate)-(100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern:
        /^text-(red|green|blue|gray|slate)-(100|200|300|400|500|600|700|800|900)$/,
    },
  ],
} satisfies Config;
