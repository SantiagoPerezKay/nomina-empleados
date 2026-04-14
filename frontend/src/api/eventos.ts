import client from './client'
import type { EventoEmpleado, EventoCreate, AprobarEventoRequest, RechazarEventoRequest, EventoHistorial } from '../types'

export const getEventos = async (params?: { estado?: string; sucursal_id?: number; limit?: number; fecha_desde?: string; fecha_hasta?: string }) => {
  const res = await client.get<EventoEmpleado[]>('/eventos', { params })
  return res.data
}

export const getEventosPendientes = async () => {
  const res = await client.get<EventoEmpleado[]>('/eventos/pendientes')
  return res.data
}

export const getEvento = async (id: number) => {
  const res = await client.get<EventoEmpleado>(`/eventos/${id}`)
  return res.data
}

export const createEvento = async (data: EventoCreate) => {
  const res = await client.post<EventoEmpleado>('/eventos', data)
  return res.data
}

export const updateEvento = async (id: number, data: Partial<EventoCreate>) => {
  const res = await client.put<EventoEmpleado>(`/eventos/${id}`, data)
  return res.data
}

export const deleteEvento = async (id: number) => {
  await client.delete(`/eventos/${id}`)
}

export const aprobarEvento = async (id: number, data: AprobarEventoRequest = {}) => {
  const res = await client.post<EventoEmpleado>(`/eventos/${id}/aprobar`, data)
  return res.data
}

export const rechazarEvento = async (id: number, data: RechazarEventoRequest) => {
  const res = await client.post<EventoEmpleado>(`/eventos/${id}/rechazar`, data)
  return res.data
}

export const getHistorialEvento = async (id: number) => {
  const res = await client.get<EventoHistorial[]>(`/eventos/${id}/historial`)
  return res.data
}
