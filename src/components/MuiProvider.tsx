'use client'

import { ThemeProvider, createTheme } from '@mui/material/styles'

type Props = { children: React.ReactNode }

// Simple static theme to avoid SSR/hydration complexity
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#009A44' }, // UND Green directly
  },
})

export default function MuiProvider({ children }: Props) {
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  )
}