import client from './client'
import type { Asistencia, AsistenciaCreate } from '../types'

export const getAsistencias = async (params?: { fecha?: string; sucursal_id?: number; empleado_id?: number }) => {
  const res = await client.get<Asistencia[]>('/asistencias', { params })
  return res.data
}

export const checkin = async (empleado_id: number) => {
  const res = await client.post<Asistencia>('/asistencias/checkin', { empleado_id })
  return res.data
}

export const checkout = async (empleado_id: number) => {
  const res = await client.post<Asistencia>('/asistencias/checkout', { empleado_id })
  return res.data
}

export const createAsistencia = async (data: AsistenciaCreate) => {
  const res = await client.post<Asistencia>('/asistencias', data)
  return res.data
}

export const updateAsistencia = async (id: number, data: Partial<AsistenciaCreate>) => {
  const res = await client.put<Asistencia>(`/asistencias/${id}`, data)
  return res.data
}

export const deleteAsistencia = async (id: number) => {
  await client.delete(`/asistencias/${id}`)
}
