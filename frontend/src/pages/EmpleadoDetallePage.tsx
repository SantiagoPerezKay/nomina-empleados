import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Stack, Title, Tabs, Text, Badge, Group, Button,
  Table, Card, Skeleton, ActionIcon, Modal, TextInput, Select,
  Checkbox, Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconArrowLeft, IconPlus, IconTrash, IconSettings } from '@tabler/icons-react'
import {
  getEmpleado, getContratosEmpleado, getEventosEmpleado,
  getAsistenciasEmpleado, getNominasEmpleado, createContrato,
} from '../api/empleados'
import { getTurnos, getSucursales, getAsignacionesTurno, createAsignacionTurno, deleteAsignacionTurno, getConceptos, getConceptosContrato, setConceptosContrato } from '../api/general'
import type { ContratoCreate, AsignacionTurnoCreate } from '../types'

const DIAS_SEMANA = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
]

const asignacionSchema = z.object({
  turno_id: z.coerce.number().min(1, 'Requerido'),
  sucursal_id: z.coerce.number().min(1, 'Requerido'),
  fecha_desde: z.string().min(1, 'Requerido'),
  fecha_hasta: z.string().optional(),
  dia_semana: z.coerce.number().nullable().optional(),
})

const contratoSchema = z.object({
  tipo_contrato: z.enum(['mensual', 'por_hora'], { required_error: 'Requerido' }),
  salario_mensual: z.coerce.number().positive().optional(),
  tarifa_hora: z.coerce.number().positive().optional(),
  hs_semanales: z.coerce.number().min(1).default(48),
  fecha_inicio: z.string().min(1, 'Requerido'),
  periodo_nomina: z.enum(['quincenal', 'mensual']).default('mensual'),
})

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const empId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [contratoOpened, { open: openContrato, close: closeContrato }] = useDisclosure()

  const [asignacionOpened, { open: openAsignacion, close: closeAsignacion }] = useDisclosure()
  const [conceptosOpened, { open: openConceptos, close: closeConceptos }] = useDisclosure()
  const [conceptoContratoId, setConceptoContratoId] = useState<number | null>(null)
  const [selectedConceptos, setSelectedConceptos] = useState<number[]>([])

  const { data: emp, isLoading } = useQuery({ queryKey: ['empleado', empId], queryFn: () => getEmpleado(empId) })
  const { data: contratos } = useQuery({ queryKey: ['empleado-contratos', empId], queryFn: () => getContratosEmpleado(empId) })
  const { data: eventos } = useQuery({ queryKey: ['empleado-eventos', empId], queryFn: () => getEventosEmpleado(empId) })
  const { data: asistencias } = useQuery({ queryKey: ['empleado-asistencias', empId], queryFn: () => getAsistenciasEmpleado(empId) })
  const { data: nominas } = useQuery({ queryKey: ['empleado-nominas', empId], queryFn: () => getNominasEmpleado(empId) })
  const { data: asignaciones } = useQuery({ queryKey: ['empleado-asignaciones', empId], queryFn: () => getAsignacionesTurno(empId) })
  const { data: turnos } = useQuery({ queryKey: ['turnos'], queryFn: getTurnos })
  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: allConceptos } = useQuery({ queryKey: ['conceptos'], queryFn: getConceptos })
  const { data: contratoConceptos } = useQuery({
    queryKey: ['contrato-conceptos', conceptoContratoId],
    queryFn: () => getConceptosContrato(conceptoContratoId!),
    enabled: !!conceptoContratoId,
  })

  const contratoMutation = useMutation({
    mutationFn: (data: z.infer<typeof contratoSchema>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = { ...data, empleado_id: empId }
      if (!payload.salario_mensual) delete payload.salario_mensual
      if (!payload.tarifa_hora) delete payload.tarifa_hora
      return createContrato(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleado-contratos', empId] })
      notifications.show({ message: 'Contrato creado', color: 'green' })
      contratoForm.reset()
      closeContrato()
    },
    onError: () => {
      notifications.show({ message: 'Error al crear contrato', color: 'red' })
    },
  })

  const asignacionMutation = useMutation({
    mutationFn: (data: AsignacionTurnoCreate) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = { ...data, empleado_id: empId }
      if (!payload.fecha_hasta) delete payload.fecha_hasta
      if (payload.dia_semana === null || payload.dia_semana === undefined) delete payload.dia_semana
      return createAsignacionTurno(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleado-asignaciones', empId] })
      notifications.show({ message: 'Horario asignado', color: 'green' })
      asignacionForm.reset()
      closeAsignacion()
    },
    onError: () => {
      notifications.show({ message: 'Error al asignar horario', color: 'red' })
    },
  })

  const deleteAsignacionMutation = useMutation({
    mutationFn: (id: number) => deleteAsignacionTurno(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleado-asignaciones', empId] })
      notifications.show({ message: 'Asignación eliminada', color: 'orange' })
    },
    onError: () => {
      notifications.show({ message: 'Error al eliminar asignación', color: 'red' })
    },
  })

  const conceptosMutation = useMutation({
    mutationFn: () => setConceptosContrato(conceptoContratoId!, selectedConceptos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrato-conceptos', conceptoContratoId] })
      notifications.show({ message: 'Conceptos actualizados', color: 'green' })
      closeConceptos()
    },
    onError: () => notifications.show({ message: 'Error al guardar conceptos', color: 'red' }),
  })

  const openConceptosModal = (contratoId: number) => {
    setConceptoContratoId(contratoId)
    const current = contratoConceptos?.map(c => c.id) ?? []
    setSelectedConceptos(current)
    openConceptos()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoForm = useForm<z.infer<typeof contratoSchema>>({
    resolver: zodResolver(contratoSchema) as any,
    defaultValues: { tipo_contrato: 'mensual', periodo_nomina: 'mensual', hs_semanales: 48 },
  })
  const tipoContrato = contratoForm.watch('tipo_contrato')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asignacionForm = useForm<z.infer<typeof asignacionSchema>>({ resolver: zodResolver(asignacionSchema) as any })

  if (isLoading) return <Skeleton h={400} />

  return (
    <Stack gap="md">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate('/empleados')}>
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Title order={2}>
          {emp?.apellido}, {emp?.nombre}
          <Badge ml="sm" color={emp?.activo ? 'green' : 'red'} variant="light">
            {emp?.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </Title>
      </Group>

      <Card withBorder p="sm" radius="md">
        <Group gap="xl" wrap="wrap">
          <Text size="sm"><b>Documento:</b> {emp?.documento ?? '—'}</Text>
          <Text size="sm"><b>Sucursal:</b> {emp?.sucursal_nombre ?? '—'}</Text>
          <Text size="sm"><b>Departamento:</b> {emp?.departamento_nombre ?? '—'}</Text>
          <Text size="sm"><b>Ingreso:</b> {emp?.fecha_ingreso}</Text>
          {emp?.fecha_egreso && <Text size="sm" c="red"><b>Egreso:</b> {emp.fecha_egreso}</Text>}
          <Text size="sm"><b>Email:</b> {emp?.email ?? '—'}</Text>
          <Text size="sm"><b>Tel:</b> {emp?.telefono ?? '—'}</Text>
        </Group>
      </Card>

      <Tabs defaultValue="contratos">
        <Tabs.List>
          <Tabs.Tab value="contratos">Contratos ({contratos?.length ?? 0})</Tabs.Tab>
          <Tabs.Tab value="horarios">Horarios ({asignaciones?.length ?? 0})</Tabs.Tab>
          <Tabs.Tab value="eventos">Eventos ({eventos?.length ?? 0})</Tabs.Tab>
          <Tabs.Tab value="asistencias">Asistencias ({asistencias?.length ?? 0})</Tabs.Tab>
          <Tabs.Tab value="nominas">Nóminas ({nominas?.length ?? 0})</Tabs.Tab>
        </Tabs.List>

        {/* Contratos */}
        <Tabs.Panel value="contratos" pt="sm">
          <Group justify="flex-end" mb="sm">
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openContrato}>
              Nuevo contrato
            </Button>
          </Group>
          <Table.ScrollContainer minWidth={500}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Salario / Tarifa</Table.Th>
                  <Table.Th>Hs/sem</Table.Th>
                  <Table.Th>Período nómina</Table.Th>
                  <Table.Th>Inicio</Table.Th>
                  <Table.Th>Fin</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Conceptos</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(contratos ?? []).map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{c.tipo_contrato}</Table.Td>
                    <Table.Td>
                      {c.tipo_contrato === 'mensual'
                        ? `$${c.salario_mensual?.toLocaleString('es-AR')}/mes`
                        : `$${c.tarifa_hora}/h`}
                    </Table.Td>
                    <Table.Td>{c.hs_semanales ?? '—'}</Table.Td>
                    <Table.Td>{c.periodo_nomina}</Table.Td>
                    <Table.Td>{c.fecha_inicio}</Table.Td>
                    <Table.Td>{c.fecha_fin ?? '—'}</Table.Td>
                    <Table.Td>
                      <Badge color={c.activo ? 'green' : 'gray'} variant="light" size="xs">
                        {c.activo ? 'Vigente' : 'Cerrado'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle" size="sm" color="blue"
                        onClick={() => {
                          setConceptoContratoId(c.id)
                          openConceptos()
                        }}
                      >
                        <IconSettings size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Horarios */}
        <Tabs.Panel value="horarios" pt="sm">
          <Group justify="space-between" mb="sm">
            <Text size="sm" c="dimmed">
              El empleado se considera presente por defecto cada día. Solo se registra novedad (evento) cuando hay ausencia, llegada tarde u horas extras.
            </Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openAsignacion}>
              Asignar horario
            </Button>
          </Group>
          <Table.ScrollContainer minWidth={600}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Turno</Table.Th>
                  <Table.Th>Día de semana</Table.Th>
                  <Table.Th>Sucursal</Table.Th>
                  <Table.Th>Desde</Table.Th>
                  <Table.Th>Hasta</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(asignaciones ?? []).length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text size="sm" c="dimmed" ta="center">Sin horarios asignados</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {(asignaciones ?? []).map((a) => {
                  const turno = turnos?.find(t => t.id === a.turno_id)
                  const sucursal = sucursales?.find(s => s.id === a.sucursal_id)
                  const diaNombre = a.dia_semana
                    ? DIAS_SEMANA.find(d => d.value === String(a.dia_semana))?.label
                    : 'Todos los días'
                  return (
                    <Table.Tr key={a.id}>
                      <Table.Td fw={500}>
                        {turno?.nombre ?? `Turno #${a.turno_id}`}
                        <Text size="xs" c="dimmed">
                          {turno ? `${turno.hora_entrada.slice(0,5)} – ${turno.hora_salida.slice(0,5)}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={a.dia_semana ? 'blue' : 'gray'} size="sm">
                          {diaNombre}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{sucursal?.nombre ?? `Suc. #${a.sucursal_id}`}</Table.Td>
                      <Table.Td>{a.fecha_desde}</Table.Td>
                      <Table.Td>{a.fecha_hasta ?? <Text size="xs" c="green">Actual</Text>}</Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red" variant="subtle" size="sm"
                          onClick={() => deleteAsignacionMutation.mutate(a.id)}
                          loading={deleteAsignacionMutation.isPending}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Eventos */}
        <Tabs.Panel value="eventos" pt="sm">
          <Table.ScrollContainer minWidth={500}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Categoría</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Observación</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(eventos ?? []).map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>{e.categoria_nombre ?? `Cat. #${e.categoria_evento_id}`}</Table.Td>
                    <Table.Td>{e.fecha_inicial.slice(0, 10)}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={e.estado === 'aprobado' ? 'green' : e.estado === 'rechazado' ? 'red' : 'orange'}
                        variant="light" size="xs"
                      >
                        {e.estado}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{e.observacion ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Asistencias */}
        <Tabs.Panel value="asistencias" pt="sm">
          <Table.ScrollContainer minWidth={400}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Entrada</Table.Th>
                  <Table.Th>Salida</Table.Th>
                  <Table.Th>Estado</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(asistencias ?? []).map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>{a.fecha}</Table.Td>
                    <Table.Td>{a.hora_entrada ?? '—'}</Table.Td>
                    <Table.Td>{a.hora_salida ?? '—'}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={a.estado === 'presente' ? 'green' : a.estado === 'tarde' ? 'yellow' : 'red'}
                        variant="light" size="xs"
                      >
                        {a.estado}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Nóminas */}
        <Tabs.Panel value="nominas" pt="sm">
          <Table.ScrollContainer minWidth={500}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Período</Table.Th>
                  <Table.Th>Salario base</Table.Th>
                  <Table.Th>Ingresos</Table.Th>
                  <Table.Th>Deducciones</Table.Th>
                  <Table.Th>Neto</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(nominas ?? []).map((n) => (
                  <Table.Tr key={n.id}>
                    <Table.Td>Período #{n.periodo_id}</Table.Td>
                    <Table.Td>${n.salario_base.toLocaleString('es-AR')}</Table.Td>
                    <Table.Td>${n.total_ingresos.toLocaleString('es-AR')}</Table.Td>
                    <Table.Td>${n.total_deducciones.toLocaleString('es-AR')}</Table.Td>
                    <Table.Td fw={700}>${n.neto_a_pagar.toLocaleString('es-AR')}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>
      </Tabs>

      {/* Modal asignar horario */}
      <Modal opened={asignacionOpened} onClose={closeAsignacion} title="Asignar horario" size="sm">
        <form onSubmit={asignacionForm.handleSubmit((d) => asignacionMutation.mutate(d as unknown as AsignacionTurnoCreate))}>
          <Stack gap="sm">
            <Select
              label="Turno *"
              placeholder="Seleccionar turno"
              data={(turnos ?? []).map(t => ({
                value: String(t.id),
                label: `${t.nombre} (${t.hora_entrada.slice(0,5)}–${t.hora_salida.slice(0,5)})`,
              }))}
              onChange={(v) => asignacionForm.setValue('turno_id', Number(v))}
              error={asignacionForm.formState.errors.turno_id?.message}
            />
            <Select
              label="Sucursal *"
              placeholder="Seleccionar sucursal"
              data={(sucursales ?? []).filter(s => s.activo).map(s => ({ value: String(s.id), label: s.nombre }))}
              onChange={(v) => asignacionForm.setValue('sucursal_id', Number(v))}
              error={asignacionForm.formState.errors.sucursal_id?.message}
            />
            <Select
              label="Día de semana"
              placeholder="Todos los días"
              clearable
              data={DIAS_SEMANA}
              onChange={(v) => asignacionForm.setValue('dia_semana', v ? Number(v) : null)}
            />
            <TextInput label="Fecha desde *" type="date" {...asignacionForm.register('fecha_desde')}
              error={asignacionForm.formState.errors.fecha_desde?.message} />
            <TextInput label="Fecha hasta" type="date" {...asignacionForm.register('fecha_hasta')} />
            <Button type="submit" loading={asignacionMutation.isPending}>Asignar</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal nuevo contrato */}
      <Modal opened={contratoOpened} onClose={closeContrato} title="Nuevo contrato" size="sm">
        <form onSubmit={contratoForm.handleSubmit((d) => contratoMutation.mutate(d))}>
          <Stack gap="sm">
            <Select
              label="Tipo de contrato *"
              data={[{ value: 'mensual', label: 'Mensual' }, { value: 'por_hora', label: 'Por hora' }]}
              value={tipoContrato ?? 'mensual'}
              onChange={(v) => contratoForm.setValue('tipo_contrato', v as 'mensual' | 'por_hora')}
              error={contratoForm.formState.errors.tipo_contrato?.message}
            />
            {tipoContrato === 'mensual' && (
              <TextInput
                label="Salario mensual *"
                type="number"
                min={0}
                {...contratoForm.register('salario_mensual')}
                error={contratoForm.formState.errors.salario_mensual?.message}
              />
            )}
            {tipoContrato === 'por_hora' && (
              <TextInput
                label="Tarifa por hora *"
                type="number"
                min={0}
                {...contratoForm.register('tarifa_hora')}
                error={contratoForm.formState.errors.tarifa_hora?.message}
              />
            )}
            <TextInput
              label="Horas semanales"
              type="number"
              min={1}
              {...contratoForm.register('hs_semanales')}
            />
            <Select
              label="Período nómina"
              data={[{ value: 'mensual', label: 'Mensual' }, { value: 'quincenal', label: 'Quincenal' }]}
              value={contratoForm.watch('periodo_nomina') ?? 'mensual'}
              onChange={(v) => contratoForm.setValue('periodo_nomina', v as 'mensual' | 'quincenal')}
            />
            <TextInput
              label="Fecha inicio *"
              type="date"
              {...contratoForm.register('fecha_inicio')}
              error={contratoForm.formState.errors.fecha_inicio?.message}
            />
            <Button type="submit" loading={contratoMutation.isPending}>Crear contrato</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal conceptos de nómina por contrato */}
      <Modal
        opened={conceptosOpened}
        onClose={closeConceptos}
        title={`Conceptos de nómina — Contrato #${conceptoContratoId}`}
        size="md"
      >
        {conceptoContratoId && (
          <ConceptosContratoModal
            contratoId={conceptoContratoId}
            allConceptos={allConceptos ?? []}
            contratoConceptos={contratoConceptos ?? []}
            onSave={(ids) => {
              setSelectedConceptos(ids)
              setConceptosContrato(conceptoContratoId, ids).then(() => {
                qc.invalidateQueries({ queryKey: ['contrato-conceptos', conceptoContratoId] })
                notifications.show({ message: 'Conceptos actualizados', color: 'green' })
                closeConceptos()
              }).catch(() => {
                notifications.show({ message: 'Error al guardar', color: 'red' })
              })
            }}
          />
        )}
      </Modal>
    </Stack>
  )
}

/* ── Componente interno para el modal de conceptos ────────────────────────── */
function ConceptosContratoModal({
  contratoId, allConceptos, contratoConceptos, onSave,
}: {
  contratoId: number
  allConceptos: Array<{ id: number; codigo: string; nombre: string; tipo: string; categoria: string; porcentaje: number | null; monto_fijo: number | null }>
  contratoConceptos: Array<{ id: number }>
  onSave: (ids: number[]) => void
}) {
  const [selected, setSelected] = useState<number[]>(
    contratoConceptos.map(c => c.id)
  )

  const toggle = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const ingresos = allConceptos.filter(c => c.tipo === 'ingreso')
  const deducciones = allConceptos.filter(c => c.tipo === 'deduccion')

  const renderConcepto = (c: typeof allConceptos[0]) => (
    <Checkbox
      key={c.id}
      label={
        <Group gap={6}>
          <Text size="sm">{c.nombre}</Text>
          <Text size="xs" c="dimmed">({c.codigo})</Text>
          {c.porcentaje && <Badge size="xs" variant="light">{Number(c.porcentaje)}%</Badge>}
          {c.monto_fijo && <Badge size="xs" variant="light" color="green">${Number(c.monto_fijo)}</Badge>}
        </Group>
      }
      checked={selected.includes(c.id)}
      onChange={() => toggle(c.id)}
      mb={6}
    />
  )

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Seleccioná los conceptos que aplican a este contrato. Si no se asigna ninguno, se aplican todos al liquidar.
      </Text>

      {ingresos.length > 0 && (
        <>
          <Text fw={600} size="sm" c="green">Ingresos</Text>
          {ingresos.map(renderConcepto)}
        </>
      )}

      {deducciones.length > 0 && (
        <>
          <Divider my="xs" />
          <Text fw={600} size="sm" c="red">Deducciones</Text>
          {deducciones.map(renderConcepto)}
        </>
      )}

      <Group justify="flex-end" mt="sm">
        <Button size="sm" onClick={() => onSave(selected)}>
          Guardar ({selected.length} conceptos)
        </Button>
      </Group>
    </Stack>
  )
}
