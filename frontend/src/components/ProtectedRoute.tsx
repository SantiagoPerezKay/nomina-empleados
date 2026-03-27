import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Center, Loader } from '@mantine/core'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Center h="100vh"><Loader /></Center>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
