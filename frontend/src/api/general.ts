import client from './client'
import type {
  Sucursal, SucursalCreate,
  Departamento, DepartamentoCreate,
  Turno, TurnoCreate,
  CategoriaEgreso, CategoriaEvento,
  ConceptoNomina, ConceptoNominaCreate,
  Encargado, EncargadoCreate,
  AsignacionTurno, AsignacionTurnoCreate,
} from '../types'

// Sucursales
export const getSucursales = async () => (await client.get<Sucursal[]>('/sucursales')).data
export const createSucursal = async (d: SucursalCreate) => (await client.post<Sucursal>('/sucursales', d)).data
export const updateSucursal = async (id: number, d: Partial<SucursalCreate>) => (await client.put<Sucursal>(`/sucursales/${id}`, d)).data
export const deleteSucursal = async (id: number) => { await client.delete(`/sucursales/${id}`) }

// Departamentos
export const getDepartamentos = async () => (await client.get<Departamento[]>('/departamentos')).data
export const createDepartamento = async (d: DepartamentoCreate) => (await client.post<Departamento>('/departamentos', d)).data
export const updateDepartamento = async (id: number, d: Partial<DepartamentoCreate>) => (await client.put<Departamento>(`/departamentos/${id}`, d)).data
export const deleteDepartamento = async (id: number) => { await client.delete(`/departamentos/${id}`) }

// Turnos
export const getTurnos = async () => (await client.get<Turno[]>('/turnos')).data
export const createTurno = async (d: TurnoCreate) => (await client.post<Turno>('/turnos', d)).data
export const updateTurno = async (id: number, d: Partial<TurnoCreate>) => (await client.put<Turno>(`/turnos/${id}`, d)).data
export const deleteTurno = async (id: number) => { await client.delete(`/turnos/${id}`) }

// Asignaciones de turno
export const getAsignacionesTurno = async (empleado_id?: number) =>
  (await client.get<AsignacionTurno[]>('/turnos/asignaciones', { params: { empleado_id } })).data
export const createAsignacionTurno = async (d: AsignacionTurnoCreate) =>
  (await client.post<AsignacionTurno>('/turnos/asignaciones', d)).data
export const deleteAsignacionTurno = async (id: number) => { await client.delete(`/turnos/asignaciones/${id}`) }

// Categorías de egreso
export const getCatEgresos = async () => (await client.get<CategoriaEgreso[]>('/cat-egresos')).data

// Categorías de evento
export const getCatEventos = async () => (await client.get<CategoriaEvento[]>('/categorias-evento')).data
export const createCatEvento = async (d: Partial<CategoriaEvento>) => (await client.post<CategoriaEvento>('/categorias-evento', d)).data
export const deleteCatEvento = async (id: number) => { await client.delete(`/categorias-evento/${id}`) }

// Conceptos de nómina
export const getConceptos = async () => (await client.get<ConceptoNomina[]>('/conceptos-nomina')).data
export const createConcepto = async (d: ConceptoNominaCreate) => (await client.post<ConceptoNomina>('/conceptos-nomina', d)).data
export const updateConcepto = async (id: number, d: Partial<ConceptoNominaCreate>) => (await client.put<ConceptoNomina>(`/conceptos-nomina/${id}`, d)).data
export const deleteConcepto = async (id: number) => { await client.delete(`/conceptos-nomina/${id}`) }

// Conceptos por contrato
export const getConceptosContrato = async (contratoId: number) =>
  (await client.get<ConceptoNomina[]>(`/contratos/${contratoId}/conceptos`)).data
export const setConceptosContrato = async (contratoId: number, conceptoIds: number[]) =>
  (await client.put<ConceptoNomina[]>(`/contratos/${contratoId}/conceptos`, { concepto_ids: conceptoIds })).data

// Encargados
export const getEncargados = async () => (await client.get<Encargado[]>('/encargados')).data
export const createEncargado = async (d: EncargadoCreate) => (await client.post<Encargado>('/encargados', d)).data
export const updateEncargado = async (id: number, d: Partial<EncargadoCreate>) => (await client.put<Encargado>(`/encargados/${id}`, d)).data
export const deleteEncargado = async (id: number) => { await client.delete(`/encargados/${id}`) }
