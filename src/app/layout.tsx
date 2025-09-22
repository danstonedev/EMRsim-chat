import { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import '../styles/chat.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'UND Assistant - Chatbot Web App',
  description: 'A modern University of North Dakota chatbot application',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  // Prevent theme flash by setting data-theme ASAP based on localStorage or system preference
  const noFlashThemeScript = `(() => {
    try {
      let t = localStorage.getItem('chat-theme');
      if (!t) {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      const d = document.documentElement;
      d.setAttribute('data-theme', t);
      // Ensure form controls/scrollbars match theme
      d.style.colorScheme = t;

      // Initialize controls (sidebar) open state pre-paint to avoid pop
      const co = localStorage.getItem('chat-controls-open');
      if (co === 'false') {
        d.setAttribute('data-controls-open', 'false');
      } else {
        d.setAttribute('data-controls-open', 'true');
      }
    } catch {}
  })();`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}