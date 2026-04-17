import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Box, Button, Center, Paper, PasswordInput,
  Stack, Text, TextInput, Title,
} from '@mantine/core'
import { useAuth } from '../contexts/AuthContext'

const schema = z.object({
  username: z.string().min(1, 'Requerido'),
  password: z.string().min(1, 'Requerido'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    setError('')
    try {
      const me = await login(data)
      const home = me.rol === 'operador' ? '/eventos' : '/'
      navigate(home, { replace: true })
    } catch {
      setError('Credenciales incorrectas')
    }
  }

  return (
    <Center h="100vh" style={{ background: 'var(--mantine-color-body)' }}>
      <Paper shadow="lg" p={40} w={400} radius="lg" withBorder>
        <Stack gap="lg">
          <Box ta="center">
            <Box
              mx="auto" mb="sm"
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-5))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text fw={800} size="xl" c="white">N</Text>
            </Box>
            <Title order={2} mb={4}>Nómina</Title>
            <Text c="dimmed" size="sm">Calzalindo — Gestión de personal</Text>
          </Box>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Usuario"
                placeholder="correo@empresa.com"
                size="md"
                {...register('username')}
                error={errors.username?.message}
              />
              <PasswordInput
                label="Contraseña"
                placeholder="Tu contraseña"
                size="md"
                {...register('password')}
                error={errors.password?.message}
              />
              {error && <Text c="red" size="sm" ta="center">{error}</Text>}
              <Button type="submit" loading={isSubmitting} fullWidth size="md" mt="xs">
                Ingresar
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  )
}
