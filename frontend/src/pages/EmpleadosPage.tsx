import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Stack, Title, Group, Button, TextInput, Select,
  Table, Badge, ActionIcon, Text, Modal, Skeleton,
  Tooltip, Checkbox, Stepper, Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconSearch, IconPlus, IconEye, IconDoorExit, IconEdit, IconAlertTriangle } from '@tabler/icons-react'
import { getEmpleados, createEmpleado, updateEmpleado, egresar, createContrato } from '../api/empleados'
import { getSucursales, getDepartamentos, getCatEgresos, getTurnos, createAsignacionTurno } from '../api/general'
import type { EmpleadoCreate, EmpleadoUpdate, EgresoRequest, ContratoCreate, AsignacionTurnoCreate } from '../types'
import { format } from 'date-fns'

const hoy = () => format(new Date(), 'yyyy-MM-dd')

const createSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  fecha_ingreso: z.string().min(1, 'Requerido'),
  nro_vendedor: z.coerce.number().optional(),
  documento: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  sucursal_id: z.coerce.number().optional(),
  departamento_id: z.coerce.number().optional(),
  en_blanco: z.boolean().default(false),
})

const contratoSchema = z.object({
  tipo_contrato: z.enum(['mensual', 'por_hora']),
  salario_mensual: z.coerce.number().positive().optional(),
  tarifa_hora: z.coerce.number().positive().optional(),
  hs_semanales: z.coerce.number().min(1).default(48),
  fecha_inicio: z.string().min(1, 'Requerido'),
  periodo_nomina: z.enum(['quincenal', 'mensual']).default('mensual'),
})

const horarioSchema = z.object({
  turno_id: z.coerce.number().min(1, 'Requerido'),
  sucursal_id: z.coerce.number().min(1, 'Requerido'),
  fecha_desde: z.string().min(1, 'Requerido'),
  dia_semana: z.coerce.number().nullable().optional(),
})

const editSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  nro_vendedor: z.coerce.number().optional(),
  documento: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  sucursal_id: z.coerce.number().optional(),
  departamento_id: z.coerce.number().optional(),
  en_blanco: z.boolean().default(false),
})

const egresoSchema = z.object({
  fecha_egreso: z.string().min(1),
  motivo_egreso: z.string().optional(),
  categoria_egreso_id: z.coerce.number().min(1, 'Requerido'),
})

const DIAS_SEMANA = [
  { value: '0', label: 'Lunes a Sábado' },
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
]

export default function EmpleadosPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filtroBaja, setFiltroBaja] = useState<string>('true')
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()
  const [wizardStep, setWizardStep] = useState(0)
  const [newEmpleadoId, setNewEmpleadoId] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<number | null>(null)
  const [egresoTarget, setEgresoTarget] = useState<number | null>(null)

  const { data: empleados, isLoading } = useQuery({
    queryKey: ['empleados', filtroBaja],
    queryFn: () => getEmpleados({ activo: filtroBaja === 'true' ? true : filtroBaja === 'false' ? false : undefined }),
  })
  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: departamentos } = useQuery({ queryKey: ['departamentos'], queryFn: getDepartamentos })
  const { data: catEgresos } = useQuery({ queryKey: ['cat-egresos'], queryFn: getCatEgresos })
  const { data: turnos } = useQuery({ queryKey: ['turnos'], queryFn: getTurnos })

  // ── Wizard forms ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema) as any,
    defaultValues: { fecha_ingreso: hoy(), en_blanco: false },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoForm = useForm<z.infer<typeof contratoSchema>>({
    resolver: zodResolver(contratoSchema) as any,
    defaultValues: { tipo_contrato: 'mensual', periodo_nomina: 'mensual', hs_semanales: 48, fecha_inicio: hoy() },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const horarioForm = useForm<z.infer<typeof horarioSchema>>({
    resolver: zodResolver(horarioSchema) as any,
    defaultValues: { fecha_desde: hoy(), dia_semana: 0 },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) as any })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const egresoForm = useForm<z.infer<typeof egresoSchema>>({
    resolver: zodResolver(egresoSchema) as any,
    defaultValues: { fecha_egreso: hoy() },
  })

  const tipoContrato = contratoForm.watch('tipo_contrato')

  // Suscripción explícita a formState.errors para que react-hook-form
  // reactive el re-render cuando se llama a setError() de forma asíncrona
  const createErrors = createForm.formState.errors
  const editErrors = editForm.formState.errors

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: EmpleadoCreate) => createEmpleado(data),
    onSuccess: (emp) => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado creado', color: 'green' })
      setNewEmpleadoId(emp.id)
      contratoForm.setValue('fecha_inicio', createForm.getValues('fecha_ingreso') || hoy())
      setWizardStep(1)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      const detail: string = err?.response?.data?.detail ?? 'Error interno del servidor'
      // Marcar el campo exacto que causó el conflicto
      if (detail.toLowerCase().includes('documento')) {
        createForm.setError('documento', { message: detail })
      } else if (detail.toLowerCase().includes('vendedor')) {
        createForm.setError('nro_vendedor', { message: detail })
      } else if (detail.toLowerCase().includes('email')) {
        createForm.setError('email', { message: detail })
      } else {
        notifications.show({ title: 'No se pudo crear el empleado', message: detail, color: 'red', autoClose: 8000 })
      }
    },
  })

  const contratoMutation = useMutation({
    mutationFn: (data: ContratoCreate) => createContrato(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Contrato creado', color: 'green' })
      // Pre-fill sucursal from empleado
      const sucId = createForm.getValues('sucursal_id')
      if (sucId) horarioForm.setValue('sucursal_id', sucId)
      setWizardStep(2)
    },
    onError: () => notifications.show({ message: 'Error al crear contrato', color: 'red' }),
  })

  const horarioMutation = useMutation({
    mutationFn: (data: AsignacionTurnoCreate) => createAsignacionTurno(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Horario asignado', color: 'green' })
      closeWizard()
    },
    onError: () => notifications.show({ message: 'Error al asignar horario', color: 'red' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmpleadoUpdate }) => updateEmpleado(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado actualizado', color: 'green' })
      setEditTarget(null)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => notifications.show({
      title: 'No se pudo actualizar',
      message: err?.response?.data?.detail ?? 'Error interno del servidor',
      color: 'red', autoClose: 8000,
    }),
  })

  const egresoMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EgresoRequest }) => egresar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado egresado', color: 'orange' })
      setEgresoTarget(null)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'Error al egresar'
      notifications.show({
        title: 'No se pudo dar de baja',
        message: detail,
        color: 'red',
        autoClose: 8000,
      })
    },
  })

  const closeWizard = () => {
    closeCreate()
    setWizardStep(0)
    setNewEmpleadoId(null)
    createForm.reset({ fecha_ingreso: hoy(), en_blanco: false })
    contratoForm.reset({ tipo_contrato: 'mensual', periodo_nomina: 'mensual', hs_semanales: 48, fecha_inicio: hoy() })
    horarioForm.reset({ fecha_desde: hoy(), dia_semana: 0 })
  }

  const filtered = (empleados ?? []).filter((e) =>
    `${e.nombre} ${e.apellido} ${e.documento ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const openEditModal = (emp: typeof filtered[0]) => {
    editForm.reset({
      nombre: emp.nombre,
      apellido: emp.apellido,
      nro_vendedor: emp.nro_vendedor ?? undefined,
      documento: emp.documento ?? '',
      email: emp.email ?? '',
      telefono: emp.telefono ?? '',
      sucursal_id: emp.sucursal_id ?? undefined,
      departamento_id: emp.departamento_id ?? undefined,
      en_blanco: emp.en_blanco ?? false,
    })
    setEditTarget(emp.id)
  }

  const handleSubmitContrato = (d: z.infer<typeof contratoSchema>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { ...d, empleado_id: newEmpleadoId! }
    if (!payload.salario_mensual) delete payload.salario_mensual
    if (!payload.tarifa_hora) delete payload.tarifa_hora
    contratoMutation.mutate(payload)
  }

  const handleSubmitHorario = (d: z.infer<typeof horarioSchema>) => {
    // dia_semana 0 = Lunes a Sábado (null en backend = todos los días)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { ...d, empleado_id: newEmpleadoId! }
    if (payload.dia_semana === 0) delete payload.dia_semana // null = todos
    horarioMutation.mutate(payload)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Empleados</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Nuevo empleado
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Buscar por nombre o documento..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={280}
        />
        <Select
          data={[
            { value: 'true', label: 'Activos' },
            { value: 'false', label: 'Inactivos' },
            { value: 'all', label: 'Todos' },
          ]}
          value={filtroBaja}
          onChange={(v) => setFiltroBaja(v ?? 'true')}
          w={130}
        />
      </Group>

      {isLoading ? (
        <Skeleton h={300} />
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Apellido y nombre</Table.Th>
                <Table.Th>Sucursal</Table.Th>
                <Table.Th>Departamento</Table.Th>
                <Table.Th>Ingreso</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 && (
                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">Sin resultados</Text></Table.Td></Table.Tr>
              )}
              {filtered.map((emp) => (
                <Table.Tr key={emp.id}>
                  <Table.Td>{emp.nro_vendedor ?? emp.id}</Table.Td>
                  <Table.Td>{emp.apellido}, {emp.nombre}</Table.Td>
                  <Table.Td>{emp.sucursal_nombre ?? '—'}</Table.Td>
                  <Table.Td>{emp.departamento_nombre ?? '—'}</Table.Td>
                  <Table.Td>{emp.fecha_ingreso}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Badge color={emp.activo ? 'green' : 'red'} variant="light">
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {emp.en_blanco && (
                        <Badge color="gray" variant="light" size="xs">En blanco</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Ver detalle">
                        <ActionIcon component={Link} to={`/empleados/${emp.id}`} variant="subtle">
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => openEditModal(emp)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {emp.activo && (
                        <Tooltip label="Egresar">
                          <ActionIcon color="red" variant="subtle" onClick={() => { setEgresoTarget(emp.id); egresoForm.reset({ fecha_egreso: hoy() }) }}>
                            <IconDoorExit size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* ── Modal wizard crear empleado ── */}
      <Modal opened={createOpened} onClose={closeWizard} title="Nuevo empleado" size="lg" closeOnClickOutside={false}>
        <Stepper active={wizardStep} size="sm" mb="md">
          <Stepper.Step label="Datos" description="Información personal" />
          <Stepper.Step label="Contrato" description="Tipo y salario" />
          <Stepper.Step label="Horario" description="Turno asignado" />
        </Stepper>

        {/* Paso 1: Datos del empleado */}
        {wizardStep === 0 && (
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d as unknown as EmpleadoCreate))}>
            <Stack gap="sm">
              <Group grow>
                <TextInput label="Nombre *" {...createForm.register('nombre')} error={createErrors.nombre?.message} />
                <TextInput label="Apellido *" {...createForm.register('apellido')} error={createErrors.apellido?.message} />
              </Group>
              <Group grow>
                <TextInput label="Fecha ingreso *" type="date" {...createForm.register('fecha_ingreso')} error={createErrors.fecha_ingreso?.message} />
                <TextInput label="Nro vendedor" type="number" {...createForm.register('nro_vendedor')} error={createErrors.nro_vendedor?.message} />
              </Group>
              <Group grow>
                <TextInput label="Documento" {...createForm.register('documento')} error={createErrors.documento?.message} />
                <TextInput label="Email" type="email" {...createForm.register('email')} error={createErrors.email?.message} />
              </Group>
              <TextInput label="Teléfono" {...createForm.register('telefono')} />
              <Group grow>
                <Select
                  label="Sucursal"
                  data={(sucursales ?? []).map(s => ({ value: String(s.id), label: s.nombre }))}
                  onChange={(v) => createForm.setValue('sucursal_id', v ? Number(v) : undefined)}
                  clearable
                />
                <Select
                  label="Departamento"
                  data={(departamentos ?? []).map(d => ({ value: String(d.id), label: d.nombre }))}
                  onChange={(v) => createForm.setValue('departamento_id', v ? Number(v) : undefined)}
                  clearable
                />
              </Group>
              <Checkbox
                label="En blanco (se aplican aportes jubilatorios y obra social)"
                checked={createForm.watch('en_blanco') ?? false}
                onChange={(e) => createForm.setValue('en_blanco', e.currentTarget.checked)}
              />
              <Button type="submit" loading={createMutation.isPending}>Siguiente: Contrato</Button>
            </Stack>
          </form>
        )}

        {/* Paso 2: Contrato */}
        {wizardStep === 1 && (
          <form onSubmit={contratoForm.handleSubmit(handleSubmitContrato)}>
            <Stack gap="sm">
              <Select
                label="Tipo de contrato *"
                data={[{ value: 'mensual', label: 'Mensual' }, { value: 'por_hora', label: 'Por hora' }]}
                value={tipoContrato ?? 'mensual'}
                onChange={(v) => contratoForm.setValue('tipo_contrato', v as 'mensual' | 'por_hora')}
              />
              {tipoContrato === 'mensual' && (
                <TextInput label="Salario mensual *" type="number" min={0} {...contratoForm.register('salario_mensual')} />
              )}
              {tipoContrato === 'por_hora' && (
                <TextInput label="Tarifa por hora *" type="number" min={0} {...contratoForm.register('tarifa_hora')} />
              )}
              <TextInput label="Horas semanales" type="number" min={1} {...contratoForm.register('hs_semanales')} />
              <Select
                label="Período nómina"
                data={[{ value: 'mensual', label: 'Mensual' }, { value: 'quincenal', label: 'Quincenal' }]}
                value={contratoForm.watch('periodo_nomina') ?? 'mensual'}
                onChange={(v) => contratoForm.setValue('periodo_nomina', v as 'mensual' | 'quincenal')}
              />
              <TextInput label="Fecha inicio *" type="date" {...contratoForm.register('fecha_inicio')} />
              <Group justify="space-between">
                <Button variant="subtle" color="orange" onClick={() => {
                  notifications.show({ message: 'Contrato omitido. Podés crearlo luego desde el detalle del empleado.', color: 'orange' })
                  setWizardStep(2)
                }}>
                  Omitir
                </Button>
                <Button type="submit" loading={contratoMutation.isPending}>Siguiente: Horario</Button>
              </Group>
              <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
                Sin contrato no se podrá liquidar nómina para este empleado.
              </Alert>
            </Stack>
          </form>
        )}

        {/* Paso 3: Horario */}
        {wizardStep === 2 && (
          <form onSubmit={horarioForm.handleSubmit(handleSubmitHorario)}>
            <Stack gap="sm">
              <Select
                label="Turno *"
                placeholder="Seleccionar turno"
                data={(turnos ?? []).map(t => ({
                  value: String(t.id),
                  label: `${t.nombre} (${t.hora_entrada.slice(0,5)}–${t.hora_salida.slice(0,5)})`,
                }))}
                onChange={(v) => horarioForm.setValue('turno_id', Number(v))}
                error={horarioForm.formState.errors.turno_id?.message}
              />
              <Select
                label="Sucursal *"
                placeholder="Seleccionar sucursal"
                data={(sucursales ?? []).filter(s => s.activo).map(s => ({ value: String(s.id), label: s.nombre }))}
                value={horarioForm.watch('sucursal_id') ? String(horarioForm.watch('sucursal_id')) : null}
                onChange={(v) => horarioForm.setValue('sucursal_id', Number(v))}
                error={horarioForm.formState.errors.sucursal_id?.message}
              />
              <Select
                label="Días"
                data={DIAS_SEMANA}
                value={String(horarioForm.watch('dia_semana') ?? 0)}
                onChange={(v) => horarioForm.setValue('dia_semana', v ? Number(v) : 0)}
              />
              <TextInput label="Fecha desde *" type="date" {...horarioForm.register('fecha_desde')} />
              <Group justify="space-between">
                <Button variant="subtle" color="orange" onClick={() => {
                  notifications.show({ message: 'Horario omitido. Podés asignarlo luego desde el detalle del empleado.', color: 'orange' })
                  closeWizard()
                }}>
                  Omitir
                </Button>
                <Button type="submit" loading={horarioMutation.isPending}>Finalizar</Button>
              </Group>
              <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
                Sin horario asignado no se podrá controlar asistencia del empleado.
              </Alert>
            </Stack>
          </form>
        )}
      </Modal>

      {/* Modal editar empleado */}
      <Modal opened={editTarget !== null} onClose={() => setEditTarget(null)} title="Editar empleado" size="md">
        <form onSubmit={editForm.handleSubmit((d) => {
          const payload: EmpleadoUpdate = { ...d }
          if (!payload.nro_vendedor) delete payload.nro_vendedor
          if (!payload.email) delete payload.email
          editMutation.mutate({ id: editTarget!, data: payload })
        })}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Nombre *" {...editForm.register('nombre')} error={editErrors.nombre?.message} />
              <TextInput label="Apellido *" {...editForm.register('apellido')} error={editErrors.apellido?.message} />
            </Group>
            <Group grow>
              <TextInput label="Nro vendedor" type="number" {...editForm.register('nro_vendedor')} />
              <TextInput label="Documento" {...editForm.register('documento')} />
            </Group>
            <Group grow>
              <TextInput label="Email" type="email" {...editForm.register('email')} />
              <TextInput label="Teléfono" {...editForm.register('telefono')} />
            </Group>
            <Group grow>
              <Select
                label="Sucursal"
                data={(sucursales ?? []).map(s => ({ value: String(s.id), label: s.nombre }))}
                value={editForm.watch('sucursal_id') ? String(editForm.watch('sucursal_id')) : null}
                onChange={(v) => editForm.setValue('sucursal_id', v ? Number(v) : undefined)}
                clearable
              />
              <Select
                label="Departamento"
                data={(departamentos ?? []).map(d => ({ value: String(d.id), label: d.nombre }))}
                value={editForm.watch('departamento_id') ? String(editForm.watch('departamento_id')) : null}
                onChange={(v) => editForm.setValue('departamento_id', v ? Number(v) : undefined)}
                clearable
              />
            </Group>
            <Checkbox
              label="En blanco (se aplican aportes jubilatorios y obra social)"
              checked={editForm.watch('en_blanco') ?? false}
              onChange={(e) => editForm.setValue('en_blanco', e.currentTarget.checked)}
            />
            <Button type="submit" loading={editMutation.isPending}>Guardar cambios</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal egresar */}
      <Modal opened={egresoTarget !== null} onClose={() => setEgresoTarget(null)} title="Registrar egreso" size="sm">
        <form onSubmit={egresoForm.handleSubmit((d) => egresoMutation.mutate({ id: egresoTarget!, data: d }))}>
          <Stack gap="sm">
            <TextInput label="Fecha egreso *" type="date" {...egresoForm.register('fecha_egreso')} error={egresoForm.formState.errors.fecha_egreso?.message} />
            <Select
              label="Categoría de egreso *"
              data={(catEgresos ?? []).map(c => ({ value: String(c.id), label: `${c.nombre} (${c.tipo})` }))}
              onChange={(v) => egresoForm.setValue('categoria_egreso_id', v ? Number(v) : 0)}
              error={egresoForm.formState.errors.categoria_egreso_id?.message}
            />
            <TextInput label="Motivo (opcional)" {...egresoForm.register('motivo_egreso')} />
            <Button type="submit" color="red" loading={egresoMutation.isPending}>Registrar egreso</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
