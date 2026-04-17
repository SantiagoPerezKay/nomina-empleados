import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  ActionIcon, Text, Modal, Textarea, Tooltip, Skeleton,
  TextInput, SimpleGrid, Paper, ThemeIcon, NumberInput,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  IconPlus, IconCheck, IconX, IconHistory,
  IconUserOff, IconClockExclamation, IconAlertTriangle, IconClockHour8,
  IconDots,
} from '@tabler/icons-react'
import { getEventos, createEvento, aprobarEvento, rechazarEvento, getHistorialEvento } from '../api/eventos'
import { getCatEventos, getSucursales } from '../api/general'
import { getEmpleados } from '../api/empleados'
import type { EventoCreate, CategoriaEvento, Empleado } from '../types'
import { format } from 'date-fns'

// ── Schemas ────────────────────────────────────────────────────────────────
const quickSchema = z.object({
  empleado_id: z.coerce.number().min(1, 'Requerido'),
  fecha: z.string().min(1, 'Requerido'),
  observacion: z.string().optional(),
})
const quickHsSchema = quickSchema.extend({
  horas_cantidad: z.coerce.number().min(0.25, 'Mín. 0.25h'),
  porcentaje_extra: z.coerce.number().refine(v => v === 50 || v === 100, 'Debe ser 50 o 100'),
})
const createSchema = z.object({
  empleado_id: z.coerce.number().min(1, 'Requerido'),
  categoria_evento_id: z.coerce.number().min(1, 'Requerido'),
  fecha_inicial: z.string().min(1),
  fecha_final: z.string().optional(),
  observacion: z.string().optional(),
  sucursal_id: z.coerce.number().optional(),
  horas_cantidad: z.coerce.number().optional(),
  porcentaje_extra: z.coerce.number().optional(),
})
const rechazarSchema = z.object({ motivo: z.string().min(1, 'Requerido') })

// ── Helpers para encontrar categorías por código ──────────────────────────
const CODIGOS = {
  falta: ['FALTA_INJ', 'falta_inj', 'FALTA', 'ausencia', 'no_llego'],
  tarde: ['llegada_tarde', 'TARDANZA', 'tardanza', 'LLEGADA_TARDE'],
  llamada: ['LLAMADA_ATENCION', 'llamada_atencion', 'LLAMADA'],
  extras: ['HE_EXTRA', 'horas_extras', 'HE_50', 'HE_100'],
}

function findCategoria(cats: CategoriaEvento[] | undefined, codigos: string[]): CategoriaEvento | undefined {
  if (!cats) return undefined
  const norm = (s: string) => s.toLowerCase().replace(/[_\s]/g, '')
  const codsNorm = codigos.map(norm)
  return cats.find(c => codsNorm.includes(norm(c.codigo)))
}

// ── Tipo de acción rápida ─────────────────────────────────────────────────
type QuickKind = 'falta' | 'tarde' | 'llamada' | 'extras' | null

const QUICK_META: Record<Exclude<QuickKind, null>, {
  title: string
  label: string
  color: string
  icon: React.ComponentType<{ size?: number }>
  codigos: string[]
  needsObservacion?: boolean
  needsHoras?: boolean
}> = {
  falta: {
    title: 'Registrar falta', label: 'Falta', color: 'red',
    icon: IconUserOff, codigos: CODIGOS.falta,
  },
  tarde: {
    title: 'Registrar llegada tarde', label: 'Llegada tarde', color: 'yellow',
    icon: IconClockExclamation, codigos: CODIGOS.tarde,
  },
  llamada: {
    title: 'Registrar llamada de atención', label: 'Llamada de atención', color: 'orange',
    icon: IconAlertTriangle, codigos: CODIGOS.llamada, needsObservacion: true,
  },
  extras: {
    title: 'Registrar horas extras', label: 'Horas extras', color: 'teal',
    icon: IconClockHour8, codigos: CODIGOS.extras, needsHoras: true,
  },
}

export default function EventosPage() {
  const qc = useQueryClient()
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [rechazarTarget, setRechazarTarget] = useState<number | null>(null)
  const [historialTarget, setHistorialTarget] = useState<number | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()
  const [quickKind, setQuickKind] = useState<QuickKind>(null)

  const { data: eventos, isLoading } = useQuery({
    queryKey: ['eventos', filtroEstado],
    queryFn: () => getEventos({ estado: filtroEstado !== 'todos' ? filtroEstado : undefined }),
  })
  const { data: catEventos } = useQuery({ queryKey: ['cat-eventos'], queryFn: getCatEventos })
  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: empleados } = useQuery({ queryKey: ['empleados-activos'], queryFn: () => getEmpleados({ activo: true }) })
  const { data: historial } = useQuery({
    queryKey: ['historial-evento', historialTarget],
    queryFn: () => getHistorialEvento(historialTarget!),
    enabled: historialTarget !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: EventoCreate) => createEvento(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento creado', color: 'green' })
      closeCreate()
      setQuickKind(null)
      quickForm.reset({ empleado_id: 0, fecha: format(new Date(), 'yyyy-MM-dd'), observacion: '' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'Error al crear evento'
      notifications.show({ title: 'No se pudo crear', message: String(detail), color: 'red', autoClose: 6000 })
    },
  })

  const aprobarMutation = useMutation({
    mutationFn: (id: number) => aprobarEvento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento aprobado', color: 'green' })
    },
  })

  const rechazarMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => rechazarEvento(id, { motivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento rechazado', color: 'orange' })
      setRechazarTarget(null)
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema) as any,
    defaultValues: {
      fecha_inicial: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      fecha_final: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  })
  const rechazarForm = useForm<z.infer<typeof rechazarSchema>>({ resolver: zodResolver(rechazarSchema) })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quickForm = useForm<z.infer<typeof quickHsSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver((quickKind === 'extras' ? quickHsSchema : quickSchema) as any) as any,
    defaultValues: {
      empleado_id: 0,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      observacion: '',
      horas_cantidad: 1,
      porcentaje_extra: 50,
    },
  })

  const empleadosMap = useMemo(() => {
    const m = new Map<number, Empleado>()
    for (const e of empleados ?? []) m.set(e.id, e)
    return m
  }, [empleados])

  const handleQuickOpen = (kind: Exclude<QuickKind, null>) => {
    const cat = findCategoria(catEventos, QUICK_META[kind].codigos)
    if (!cat) {
      notifications.show({
        title: 'Categoría no encontrada',
        message: `No existe la categoría para "${QUICK_META[kind].label}" en el catálogo. Creala en Configuración.`,
        color: 'red',
        autoClose: 7000,
      })
      return
    }
    quickForm.reset({
      empleado_id: 0,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      observacion: '',
      horas_cantidad: 1,
      porcentaje_extra: 50,
    })
    setQuickKind(kind)
  }

  const handleQuickSubmit = quickForm.handleSubmit((d) => {
    if (!quickKind) return
    const meta = QUICK_META[quickKind]
    const cat = findCategoria(catEventos, meta.codigos)
    if (!cat) return
    const emp = empleadosMap.get(Number(d.empleado_id))
    if (!emp) {
      notifications.show({ message: 'Empleado inválido', color: 'red' })
      return
    }
    if (!emp.sucursal_id) {
      notifications.show({
        title: 'Empleado sin sucursal',
        message: 'El empleado no tiene sucursal asignada. Asignala antes de crear el evento.',
        color: 'red', autoClose: 7000,
      })
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      empleado_id: emp.id,
      sucursal_id: emp.sucursal_id,
      categoria_evento_id: cat.id,
      fecha_inicial: `${d.fecha}T00:00`,
    }
    if (d.observacion) payload.observacion = d.observacion
    if (meta.needsHoras) {
      payload.horas_cantidad = d.horas_cantidad
      payload.porcentaje_extra = d.porcentaje_extra
    }
    createMutation.mutate(payload as EventoCreate)
  })

  const estadoColor = (e: string) =>
    e === 'aprobado' ? 'green' : e === 'rechazado' ? 'red' : e === 'actualizado' ? 'blue' : 'orange'

  const quickMeta = quickKind ? QUICK_META[quickKind] : null

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Eventos</Title>
        <Button leftSection={<IconDots size={16} />} variant="light" onClick={openCreate}>
          Otro evento
        </Button>
      </Group>

      {/* ── Barra de acciones rápidas ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {(Object.keys(QUICK_META) as Array<Exclude<QuickKind, null>>).map(k => {
          const m = QUICK_META[k]
          const Icon = m.icon
          return (
            <Paper
              key={k}
              p="md"
              withBorder
              radius="md"
              style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
              onClick={() => handleQuickOpen(k)}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon color={m.color} variant="light" size={42} radius="md">
                  <Icon size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed" fw={500}>Registrar</Text>
                  <Text fw={600} size="sm">{m.label}</Text>
                </Stack>
              </Group>
            </Paper>
          )
        })}
      </SimpleGrid>

      <Select
        data={[
          { value: 'sin_revisar', label: 'Sin revisar' },
          { value: 'aprobado', label: 'Aprobados' },
          { value: 'rechazado', label: 'Rechazados' },
          { value: 'todos', label: 'Todos' },
        ]}
        value={filtroEstado}
        onChange={(v) => setFiltroEstado(v ?? 'sin_revisar')}
        w={180}
      />

      {isLoading ? <Skeleton h={300} /> : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Empleado</Table.Th>
                <Table.Th>Creado por</Table.Th>
                <Table.Th>Categoría</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Sucursal</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Observación</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(eventos ?? []).length === 0 && (
                <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center">Sin eventos</Text></Table.Td></Table.Tr>
              )}
              {(eventos ?? []).map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{e.empleado_nombre ?? `#${e.empleado_id}`}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{e.created_by_nombre ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>{e.categoria_nombre ?? `#${e.categoria_evento_id}`}</Table.Td>
                  <Table.Td>{e.fecha_inicial.slice(0, 10)}</Table.Td>
                  <Table.Td>{e.sucursal_nombre ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={estadoColor(e.estado)} variant="light" size="xs">{e.estado}</Badge>
                  </Table.Td>
                  <Table.Td>{e.observacion ?? '—'}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {e.estado === 'sin_revisar' && (
                        <>
                          <Tooltip label="Aprobar">
                            <ActionIcon
                              color="green" variant="subtle" size="sm"
                              onClick={() => aprobarMutation.mutate(e.id)}
                              loading={aprobarMutation.isPending}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Rechazar">
                            <ActionIcon
                              color="red" variant="subtle" size="sm"
                              onClick={() => { setRechazarTarget(e.id); rechazarForm.reset() }}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip label="Historial">
                        <ActionIcon
                          color="blue" variant="subtle" size="sm"
                          onClick={() => setHistorialTarget(e.id)}
                        >
                          <IconHistory size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* ── Modal acción rápida ── */}
      <Modal
        opened={quickKind !== null}
        onClose={() => setQuickKind(null)}
        title={quickMeta?.title ?? ''}
        size="sm"
      >
        {quickMeta && (
          <form onSubmit={handleQuickSubmit}>
            <Stack gap="sm">
              <Group gap="sm">
                <ThemeIcon color={quickMeta.color} variant="light" size={40} radius="md">
                  <quickMeta.icon size={22} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Se creará un evento de tipo <b>{quickMeta.label}</b>
                </Text>
              </Group>

              <Controller
                control={quickForm.control}
                name="empleado_id"
                render={({ field, fieldState }) => (
                  <Select
                    label="Empleado *"
                    placeholder="Buscar empleado..."
                    data={(empleados ?? []).map(e => ({
                      value: String(e.id),
                      label: `${e.apellido}, ${e.nombre}${e.sucursal_nombre ? ` — ${e.sucursal_nombre}` : ''}`,
                    }))}
                    searchable
                    value={field.value ? String(field.value) : null}
                    onChange={(v) => field.onChange(v ? Number(v) : 0)}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TextInput
                label="Fecha *"
                type="date"
                {...quickForm.register('fecha')}
                error={quickForm.formState.errors.fecha?.message}
              />

              {quickMeta.needsHoras && (
                <Group grow>
                  <Controller
                    control={quickForm.control}
                    name="horas_cantidad"
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Cantidad de horas *"
                        min={0.25} step={0.25} decimalScale={2}
                        value={field.value}
                        onChange={(v) => field.onChange(Number(v))}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={quickForm.control}
                    name="porcentaje_extra"
                    render={({ field, fieldState }) => (
                      <Select
                        label="Porcentaje *"
                        data={[
                          { value: '50', label: '50% (día hábil)' },
                          { value: '100', label: '100% (feriado/dom)' },
                        ]}
                        value={String(field.value)}
                        onChange={(v) => field.onChange(v ? Number(v) : 50)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
              )}

              <Textarea
                label={quickMeta.needsObservacion ? 'Motivo *' : 'Observación'}
                placeholder={quickMeta.needsObservacion ? 'Describí el motivo de la llamada de atención' : ''}
                autosize
                minRows={2}
                {...quickForm.register('observacion', quickMeta.needsObservacion ? { required: 'Requerido' } : {})}
                error={quickForm.formState.errors.observacion?.message}
              />

              <Group justify="flex-end" mt="xs">
                <Button variant="subtle" onClick={() => setQuickKind(null)}>Cancelar</Button>
                <Button type="submit" color={quickMeta.color} loading={createMutation.isPending}>
                  Registrar
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* Modal nuevo evento (completo) */}
      <Modal opened={createOpened} onClose={closeCreate} title="Nuevo evento" size="md">
        <form onSubmit={createForm.handleSubmit((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = { ...d }
          if (!payload.fecha_final) delete payload.fecha_final
          if (!payload.sucursal_id) delete payload.sucursal_id
          if (!payload.observacion) delete payload.observacion
          // Solo incluir horas/porcentaje si la categoría es horas extras
          const catSel = catEventos?.find(c => c.id === payload.categoria_evento_id)
          const esHsExtras = catSel && CODIGOS.extras.some(
            code => code.toLowerCase().replace(/[_\s]/g, '') === catSel.codigo.toLowerCase().replace(/[_\s]/g, '')
          )
          if (!esHsExtras) {
            delete payload.horas_cantidad
            delete payload.porcentaje_extra
          } else {
            if (!payload.horas_cantidad) {
              notifications.show({
                title: 'Falta cantidad de horas',
                message: 'Para horas extras debés indicar la cantidad de horas.',
                color: 'red',
              })
              return
            }
            if (!payload.porcentaje_extra) payload.porcentaje_extra = 50
          }
          createMutation.mutate(payload as EventoCreate)
        })}>
          <Stack gap="sm">
            <Select
              label="Empleado *"
              data={(empleados ?? []).map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }))}
              searchable
              onChange={(v) => createForm.setValue('empleado_id', Number(v))}
            />
            <Select
              label="Categoría *"
              data={(catEventos ?? []).map(c => ({ value: String(c.id), label: c.nombre }))}
              value={createForm.watch('categoria_evento_id') ? String(createForm.watch('categoria_evento_id')) : null}
              onChange={(v) => createForm.setValue('categoria_evento_id', Number(v))}
            />
            {/* Campos específicos de horas extras */}
            {(() => {
              const catId = createForm.watch('categoria_evento_id')
              const catSel = catEventos?.find(c => c.id === catId)
              const esHsExtras = catSel && CODIGOS.extras.some(
                code => code.toLowerCase().replace(/[_\s]/g, '') === catSel.codigo.toLowerCase().replace(/[_\s]/g, '')
              )
              if (!esHsExtras) return null
              return (
                <Group grow>
                  <Controller
                    control={createForm.control}
                    name="horas_cantidad"
                    render={({ field }) => (
                      <NumberInput
                        label="Cantidad de horas *"
                        min={0.25} step={0.25} decimalScale={2}
                        value={field.value ?? ''}
                        onChange={(v) => field.onChange(v === '' ? undefined : Number(v))}
                      />
                    )}
                  />
                  <Controller
                    control={createForm.control}
                    name="porcentaje_extra"
                    render={({ field }) => (
                      <Select
                        label="Porcentaje *"
                        data={[
                          { value: '50', label: '50% (día hábil)' },
                          { value: '100', label: '100% (feriado/dom)' },
                        ]}
                        value={field.value ? String(field.value) : '50'}
                        onChange={(v) => field.onChange(v ? Number(v) : 50)}
                      />
                    )}
                  />
                </Group>
              )
            })()}
            <Group grow>
              <TextInput label="Fecha inicial *" type="datetime-local" {...createForm.register('fecha_inicial')} />
              <TextInput label="Fecha final" type="datetime-local" {...createForm.register('fecha_final')} />
            </Group>
            <Select
              label="Sucursal"
              data={(sucursales ?? []).map(s => ({ value: String(s.id), label: s.nombre }))}
              clearable
              onChange={(v) => createForm.setValue('sucursal_id', v ? Number(v) : undefined)}
            />
            <Textarea label="Observación" {...createForm.register('observacion')} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={closeCreate}>Cancelar</Button>
              <Button type="submit" leftSection={<IconPlus size={14} />} loading={createMutation.isPending}>Crear</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal rechazar */}
      <Modal
        opened={rechazarTarget !== null}
        onClose={() => setRechazarTarget(null)}
        title="Rechazar evento"
        size="sm"
      >
        <form onSubmit={rechazarForm.handleSubmit((d) =>
          rechazarMutation.mutate({ id: rechazarTarget!, motivo: d.motivo })
        )}>
          <Stack gap="sm">
            <Textarea
              label="Motivo *"
              {...rechazarForm.register('motivo')}
              error={rechazarForm.formState.errors.motivo?.message}
            />
            <Button type="submit" color="red" loading={rechazarMutation.isPending}>
              Rechazar
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal historial */}
      <Modal
        opened={historialTarget !== null}
        onClose={() => setHistorialTarget(null)}
        title="Historial del evento"
        size="md"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Anterior</Table.Th>
              <Table.Th>Nuevo</Table.Th>
              <Table.Th>Motivo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(historial ?? []).map((h) => (
              <Table.Tr key={h.id}>
                <Table.Td>{new Date(h.created_at).toLocaleString('es-AR')}</Table.Td>
                <Table.Td>{h.estado_anterior ?? '—'}</Table.Td>
                <Table.Td>{h.estado_nuevo}</Table.Td>
                <Table.Td>{h.motivo ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Modal>
    </Stack>
  )
}
