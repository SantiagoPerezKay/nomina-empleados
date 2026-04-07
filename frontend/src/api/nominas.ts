import client from './client'
import type { PeriodoNomina, PeriodoCreate, Nomina, NominaDetalle, NominaDetalleCreate } from '../types'

// Períodos
export const getPeriodos = async () => {
  const res = await client.get<PeriodoNomina[]>('/periodos-nomina')
  return res.data
}

export const createPeriodo = async (data: PeriodoCreate) => {
  const res = await client.post<PeriodoNomina>('/periodos-nomina', data)
  return res.data
}

export const cerrarPeriodo = async (id: number) => {
  const res = await client.post<PeriodoNomina>(`/periodos-nomina/${id}/cerrar`)
  return res.data
}

// Nóminas
export const calcularNomina = async (periodo_id: number) => {
  const res = await client.post<Nomina[]>('/nominas/calcular', { periodo_id })
  return res.data
}

export const getNominas = async (periodo_id: number) => {
  const res = await client.get<Nomina[]>('/nominas', { params: { periodo_id } })
  return res.data
}

export const getNomina = async (id: number) => {
  const res = await client.get<Nomina>(`/nominas/${id}`)
  return res.data
}

export const getDetallesNomina = async (id: number) => {
  const res = await client.get<NominaDetalle[]>(`/nominas/${id}/detalles`)
  return res.data
}

export const addDetalle = async (nomina_id: number, data: NominaDetalleCreate) => {
  const res = await client.post<NominaDetalle>(`/nominas/${nomina_id}/detalles`, data)
  return res.data
}

export const deleteDetalle = async (nomina_id: number, detalle_id: number) => {
  await client.delete(`/nominas/${nomina_id}/detalles/${detalle_id}`)
}

export const recalcularNomina = async (id: number) => {
  const res = await client.post<Nomina>(`/nominas/${id}/recalcular`)
  return res.data
}
