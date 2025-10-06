import { createRoot } from 'react-dom/client'
import './styles/brand.css'
import './styles/chat.css'
import AppRouter from './AppRouter'
import { SettingsProvider } from './shared/settingsContext'
import ErrorBoundary from './shared/ErrorBoundary'

const root = createRoot(document.getElementById('root')!)
root.render(
	<ErrorBoundary>
		<SettingsProvider>
			<AppRouter />
		</SettingsProvider>
	</ErrorBoundary>
)
