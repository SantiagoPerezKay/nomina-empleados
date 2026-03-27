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
      await login(data)
      navigate('/', { replace: true })
    } catch {
      setError('Credenciales incorrectas')
    }
  }

  return (
    <Center h="100vh" bg="gray.0">
      <Paper shadow="md" p="xl" w={360} radius="md">
        <Stack gap="md">
          <Box ta="center">
            <Title order={2}>Nómina</Title>
            <Text c="dimmed" size="sm">Calzalindo</Text>
          </Box>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="sm">
              <TextInput
                label="Usuario"
                {...register('username')}
                error={errors.username?.message}
              />
              <PasswordInput
                label="Contraseña"
                {...register('password')}
                error={errors.password?.message}
              />
              {error && <Text c="red" size="sm">{error}</Text>}
              <Button type="submit" loading={isSubmitting} fullWidth mt="xs">
                Ingresar
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  )
}
