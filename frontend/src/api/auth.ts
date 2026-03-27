import client from './client'
import type { TokenResponse, Usuario, LoginRequest } from '../types'

export const login = async (data: LoginRequest): Promise<TokenResponse> => {
  const form = new URLSearchParams()
  form.append('username', data.username)
  form.append('password', data.password)
  const res = await client.post<TokenResponse>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export const getMe = async (): Promise<Usuario> => {
  const res = await client.get<Usuario>('/auth/me')
  return res.data
}

export const getUsuarios = async (): Promise<Usuario[]> => {
  const res = await client.get<Usuario[]>('/usuarios')
  return res.data
}

export const updateUsuario = async (id: number, data: Partial<Usuario>): Promise<Usuario> => {
  const res = await client.put<Usuario>(`/usuarios/${id}`, data)
  return res.data
}

export const deleteUsuario = async (id: number): Promise<void> => {
  await client.delete(`/usuarios/${id}`)
}

export const cambiarPassword = async (data: { password_actual: string; password_nuevo: string }): Promise<void> => {
  await client.post('/cambiar-password', data)
}
