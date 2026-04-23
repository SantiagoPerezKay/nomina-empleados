import client from './client'
import type { CuentaCorriente, CuentaCorrienteCreate } from '../types'

export const getCuentaCorriente = async (params?: { empleado_id?: number; solo_pendientes?: boolean }) => {
  const res = await client.get<CuentaCorriente[]>('/cuenta-corriente', { params })
  return res.data
}

export const createCargo = async (data: CuentaCorrienteCreate) => {
  const res = await client.post<CuentaCorriente>('/cuenta-corriente', data)
  return res.data
}

export const deleteCargo = async (id: number) => {
  await client.delete(`/cuenta-corriente/${id}`)
}
