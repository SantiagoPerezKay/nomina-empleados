import client from './client'
import type { ReporteNominaEmpleado, ReporteAsistencia, ReporteEgreso, ReporteEmpleadoActivo } from '../types'

export const getReporteNomina = async (periodo_id: number, sucursal_id?: number) =>
  (await client.get<ReporteNominaEmpleado[]>(`/reportes/nomina/${periodo_id}`, { params: { sucursal_id } })).data

export const getReporteAsistencias = async (fecha_desde: string, fecha_hasta: string, sucursal_id?: number) =>
  (await client.get<ReporteAsistencia[]>('/reportes/asistencias', { params: { fecha_desde, fecha_hasta, sucursal_id } })).data

export const getReporteEgresos = async (fecha_desde: string, fecha_hasta: string, sucursal_id?: number) =>
  (await client.get<ReporteEgreso[]>('/reportes/egresos', { params: { fecha_desde, fecha_hasta, sucursal_id } })).data

export const getReporteEmpleadosActivos = async (sucursal_id?: number, departamento_id?: number) =>
  (await client.get<ReporteEmpleadoActivo[]>('/reportes/empleados/activos', { params: { sucursal_id, departamento_id } })).data
