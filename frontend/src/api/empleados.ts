import client from './client'
import type {
  Empleado, EmpleadoCreate, EmpleadoUpdate, EgresoRequest,
  Contrato, ContratoCreate, EventoEmpleado, Asistencia, Nomina,
} from '../types'

export const getEmpleados = async (params?: { activo?: boolean; sucursal_id?: number; departamento_id?: number }) => {
  const res = await client.get<Empleado[]>('/empleados', { params })
  return res.data
}

export const getEmpleado = async (id: number) => {
  const res = await client.get<Empleado>(`/empleados/${id}`)
  return res.data
}

export const createEmpleado = async (data: EmpleadoCreate) => {
  const res = await client.post<Empleado>('/empleados', data)
  return res.data
}

export const updateEmpleado = async (id: number, data: EmpleadoUpdate) => {
  const res = await client.put<Empleado>(`/empleados/${id}`, data)
  return res.data
}

export const egresar = async (id: number, data: EgresoRequest) => {
  const res = await client.post<Empleado>(`/empleados/${id}/egresar`, data)
  return res.data
}

export const reingreso = async (id: number) => {
  const res = await client.post<Empleado>(`/empleados/${id}/reingreso`)
  return res.data
}

export const getContratosEmpleado = async (id: number) => {
  const res = await client.get<Contrato[]>(`/empleados/${id}/contratos`)
  return res.data
}

export const getEventosEmpleado = async (id: number, params?: { estado?: string; fecha_desde?: string; fecha_hasta?: string }) => {
  const res = await client.get<EventoEmpleado[]>(`/empleados/${id}/eventos`, { params })
  return res.data
}

export const getAsistenciasEmpleado = async (id: number, params?: { fecha_desde?: string; fecha_hasta?: string }) => {
  const res = await client.get<Asistencia[]>(`/empleados/${id}/asistencias`, { params })
  return res.data
}

export const getNominasEmpleado = async (id: number) => {
  const res = await client.get<Nomina[]>(`/empleados/${id}/nominas`)
  return res.data
}

// Contratos
export const createContrato = async (data: ContratoCreate) => {
  const res = await client.post<Contrato>('/contratos', data)
  return res.data
}

export const cerrarContrato = async (id: number) => {
  const res = await client.post<Contrato>(`/contratos/${id}/cerrar`)
  return res.data
}

export const deleteContrato = async (id: number) => {
  await client.delete(`/contratos/${id}`)
}
