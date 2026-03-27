import client from './client'
import type { DashboardKPIs, NominaPorSucursal, EventoEmpleado } from '../types'

export const getKPIs = async () => (await client.get<DashboardKPIs>('/dashboard/kpis')).data

export const getEventosPendientesDashboard = async (sucursal_id?: number) =>
  (await client.get<EventoEmpleado[]>('/dashboard/eventos-pendientes', { params: { sucursal_id } })).data

export const getNominasPorSucursal = async (periodo_id?: number) =>
  (await client.get<NominaPorSucursal[]>('/dashboard/nominas-por-sucursal', { params: { periodo_id } })).data
