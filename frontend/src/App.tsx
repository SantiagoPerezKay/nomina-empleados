import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'

import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EmpleadosPage from './pages/EmpleadosPage'
import EmpleadoDetallePage from './pages/EmpleadoDetallePage'
import EventosPage from './pages/EventosPage'
import NominasPage from './pages/NominasPage'
import ReportesPage from './pages/ReportesPage'
import ConfigPage from './pages/ConfigPage'
import CalendarPage from './pages/CalendarPage'
import { theme } from './theme'
import { useColorSchemeStore } from './stores/colorScheme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  const colorScheme = useColorSchemeStore((s) => s.colorScheme)

  return (
    <QueryClientProvider client={queryClient}>
      <ColorSchemeScript defaultColorScheme={colorScheme} />
      <MantineProvider theme={theme} defaultColorScheme={colorScheme}>
        <Notifications position="top-right" />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="empleados" element={<EmpleadosPage />} />
                <Route path="empleados/:id" element={<EmpleadoDetallePage />} />
                <Route path="eventos" element={<EventosPage />} />
                <Route path="nominas" element={<NominasPage />} />
                <Route path="reportes" element={<ReportesPage />} />
                <Route path="calendario" element={<CalendarPage />} />
                <Route path="config" element={<ConfigPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}
