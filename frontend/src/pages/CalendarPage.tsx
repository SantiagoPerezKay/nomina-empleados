import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  Modal, Textarea, Text, Card, ActionIcon, Tooltip,
  Box, SimpleGrid, UnstyledButton, TextInput, HoverCard, Divider, Chip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  IconPlus, IconChevronLeft, IconChevronRight,
  IconCheck, IconX, IconTrash, IconEdit,
} from '@tabler/icons-react'
import {
  getEventos, createEvento, updateEvento, deleteEvento,
  aprobarEvento, rechazarEvento,
} from '../api/eventos'
import { getCatEventos, getSucursales } from '../api/general'
import { getEmpleados } from '../api/empleados'
import type { EventoCreate, EventoEmpleado } from '../types'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

const eventoSchema = z.object({
  empleado_id: z.coerce.number().min(1, 'Requerido'),
  categoria_evento_id: z.coerce.number().min(1, 'Requerido'),
  fecha_inicial: z.string().min(1),
  fecha_final: z.string().optional(),
  observacion: z.string().optional(),
  sucursal_id: z.coerce.number().optional(),
})

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const estadoColor = (e: string) =>
  e === 'aprobado' ? 'green' : e === 'rechazado' ? 'red' : e === 'actualizado' ? 'blue' : 'orange'

export default function CalendarPage() {
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editTarget, setEditTarget] = useState<EventoEmpleado | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()
  const [rechazarTarget, setRechazarTarget] = useState<number | null>(null)
  const [rechazarMotivo, setRechazarMotivo] = useState('')
  // Filtro de categorías: 'all' = todas, o array de IDs como string
  const [filtrosCat, setFiltrosCat] = useState<string[]>(['all'])

  // Fetch events for the visible month range
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const { data: eventos } = useQuery({
    queryKey: ['eventos-calendar', format(calStart, 'yyyy-MM-dd'), format(calEnd, 'yyyy-MM-dd')],
    queryFn: () => getEventos({
      fecha_desde: format(calStart, 'yyyy-MM-dd'),
      fecha_hasta: format(calEnd, 'yyyy-MM-dd'),
      limit: 1000,
    }),
  })

  const { data: catEventos } = useQuery({ queryKey: ['cat-eventos'], queryFn: getCatEventos })
  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: empleados } = useQuery({
    queryKey: ['empleados-activos'],
    queryFn: () => getEmpleados({ activo: true }),
  })

  const createMutation = useMutation({
    mutationFn: (data: EventoCreate) => createEvento(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-calendar'] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento creado', color: 'green' })
      closeCreate()
      createForm.reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EventoCreate> }) => updateEvento(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-calendar'] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento actualizado', color: 'blue' })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-calendar'] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento eliminado', color: 'red' })
    },
  })

  const aprobarMutation = useMutation({
    mutationFn: (id: number) => aprobarEvento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-calendar'] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento aprobado', color: 'green' })
    },
  })

  const rechazarMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => rechazarEvento(id, { motivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-calendar'] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      notifications.show({ message: 'Evento rechazado', color: 'orange' })
      setRechazarTarget(null)
      setRechazarMotivo('')
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createForm = useForm<z.infer<typeof eventoSchema>>({
    resolver: zodResolver(eventoSchema) as any,
    defaultValues: {
      fecha_inicial: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      fecha_final: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editForm = useForm<z.infer<typeof eventoSchema>>({
    resolver: zodResolver(eventoSchema) as any,
  })

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let day = start
    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Eventos filtrados por categoría seleccionada
  const eventosFiltrados = useMemo(() => {
    const all = eventos ?? []
    if (filtrosCat.includes('all')) return all
    const ids = new Set(filtrosCat.map(Number))
    return all.filter(ev => ids.has(ev.categoria_evento_id))
  }, [eventos, filtrosCat])

  // Categorías presentes en el mes actual (para los chips de filtro)
  const categoriasEnMes = useMemo(() => {
    const seen = new Map<number, string>()
    for (const ev of eventos ?? []) {
      if (!seen.has(ev.categoria_evento_id)) {
        seen.set(ev.categoria_evento_id, ev.categoria_nombre ?? `#${ev.categoria_evento_id}`)
      }
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [eventos])

  // Map events to dates — expande eventos multi-día (ej: vacaciones)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventoEmpleado[]>()
    for (const ev of eventosFiltrados) {
      const start = parseISO(ev.fecha_inicial.slice(0, 10))
      const end = ev.fecha_final ? parseISO(ev.fecha_final.slice(0, 10)) : start
      let cur = start
      while (cur <= end) {
        const key = format(cur, 'yyyy-MM-dd')
        if (!map.has(key)) map.set(key, [])
        if (!map.get(key)!.find(e => e.id === ev.id)) {
          map.get(key)!.push(ev)
        }
        cur = addDays(cur, 1)
      }
    }
    return map
  }, [eventosFiltrados])

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return eventsByDate.get(key) ?? []
  }, [selectedDate, eventsByDate])

  const handleCreateForDate = (date: Date) => {
    const dt = format(date, "yyyy-MM-dd'T'HH:mm")
    createForm.reset({
      fecha_inicial: dt,
      fecha_final: dt,
    })
    openCreate()
  }

  const handleEdit = (ev: EventoEmpleado) => {
    setEditTarget(ev)
    editForm.reset({
      empleado_id: ev.empleado_id,
      categoria_evento_id: ev.categoria_evento_id,
      fecha_inicial: ev.fecha_inicial.slice(0, 16),
      fecha_final: ev.fecha_final?.slice(0, 16) ?? '',
      observacion: ev.observacion ?? '',
      sucursal_id: ev.sucursal_id ?? undefined,
    })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Calendario</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleCreateForDate(new Date())}>
          Nuevo evento
        </Button>
      </Group>

      {/* Filtros de categoría */}
      {categoriasEnMes.length > 0 && (
        <Chip.Group
          multiple
          value={filtrosCat}
          onChange={(vals) => {
            if (!vals.length) { setFiltrosCat(['all']); return }
            // Si se selecciona 'all', deseleccionar el resto
            if (vals.includes('all') && !filtrosCat.includes('all')) {
              setFiltrosCat(['all'])
            } else {
              setFiltrosCat(vals.filter(v => v !== 'all'))
            }
          }}
        >
          <Group gap="xs" wrap="wrap">
            <Chip value="all" size="xs" variant="filled">Todos</Chip>
            {categoriasEnMes.map(cat => (
              <Chip key={cat.id} value={String(cat.id)} size="xs">
                {cat.nombre}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}

      {/* Month navigation */}
      <Card p="md">
        <Group justify="space-between" mb="md">
          <ActionIcon variant="subtle" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <IconChevronLeft size={20} />
          </ActionIcon>
          <Text fw={700} size="lg" tt="capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </Text>
          <ActionIcon variant="subtle" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>

        {/* Weekday headers */}
        <SimpleGrid cols={7} spacing={0}>
          {WEEKDAYS.map(d => (
            <Text key={d} ta="center" fw={600} size="sm" c="dimmed" pb="xs">
              {d}
            </Text>
          ))}
        </SimpleGrid>

        {/* Calendar grid */}
        <SimpleGrid cols={7} spacing={0}>
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate.get(key) ?? []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isCurrentDay = isToday(day)

            const cellContent = (
              <UnstyledButton
                key={key}
                onClick={() => setSelectedDate(day)}
                p={4}
                style={{
                  borderRadius: 'var(--mantine-radius-sm)',
                  border: isSelected
                    ? '2px solid var(--mantine-color-indigo-6)'
                    : '1px solid transparent',
                  backgroundColor: isSelected
                    ? 'var(--mantine-color-indigo-light)'
                    : undefined,
                  minHeight: 80,
                  opacity: isCurrentMonth ? 1 : 0.35,
                  width: '100%',
                }}
              >
                <Text
                  size="sm"
                  fw={isCurrentDay ? 800 : 400}
                  c={isCurrentDay ? 'indigo' : undefined}
                  mb={2}
                >
                  {format(day, 'd')}
                </Text>
                <Stack gap={2}>
                  {dayEvents.slice(0, 3).map(ev => {
                    const isMultiDay = ev.fecha_final && ev.fecha_final.slice(0,10) !== ev.fecha_inicial.slice(0,10)
                    const isStart = format(day, 'yyyy-MM-dd') === ev.fecha_inicial.slice(0,10)
                    return (
                    <Box
                      key={ev.id}
                      px={4} py={1}
                      style={{
                        borderRadius: 4,
                        backgroundColor: `var(--mantine-color-${estadoColor(ev.estado)}-light)`,
                        borderLeft: isMultiDay ? `3px solid var(--mantine-color-${estadoColor(ev.estado)}-6)` : undefined,
                        overflow: 'hidden',
                      }}
                    >
                      <Text size="xs" truncate lh={1.3}>
                        {isMultiDay && isStart ? '▶ ' : isMultiDay ? '  ' : ''}{ev.empleado_nombre ?? `#${ev.empleado_id}`}
                      </Text>
                    </Box>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <Text size="xs" c="dimmed" ta="center">+{dayEvents.length - 3} más</Text>
                  )}
                </Stack>
              </UnstyledButton>
            )

            if (dayEvents.length === 0) return <Box key={key}>{cellContent}</Box>

            return (
              <HoverCard
                key={key}
                width={260}
                shadow="md"
                withArrow
                openDelay={180}
                closeDelay={80}
                position="right"
                withinPortal
              >
                <HoverCard.Target>{cellContent}</HoverCard.Target>
                <HoverCard.Dropdown p="sm">
                  <Text fw={600} size="sm" mb={6}>
                    {format(day, "d 'de' MMMM", { locale: es })}
                    <Text span c="dimmed" fw={400}> · {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}</Text>
                  </Text>
                  <Divider mb={8} />
                  <Stack gap={8}>
                    {dayEvents.map((ev) => (
                      <Box key={ev.id}>
                        <Group justify="space-between" wrap="nowrap" gap={6}>
                          <Text size="xs" fw={600} truncate style={{ flex: 1 }}>
                            {ev.empleado_nombre ?? `#${ev.empleado_id}`}
                          </Text>
                          <Badge
                            color={estadoColor(ev.estado)}
                            variant="light"
                            size="xs"
                            style={{ flexShrink: 0 }}
                          >
                            {ev.estado}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={2}>
                          {ev.categoria_nombre ?? `Cat. #${ev.categoria_evento_id}`}
                          {ev.horas_cantidad ? ` · ${Number(ev.horas_cantidad).toFixed(1)}h` : ''}
                          {ev.porcentaje_extra ? ` (${ev.porcentaje_extra}%)` : ''}
                          {ev.monto ? ` · $${Number(ev.monto).toLocaleString('es-AR')}` : ''}
                          {ev.fecha_final && ev.fecha_final.slice(0,10) !== ev.fecha_inicial.slice(0,10)
                            ? ` · ${ev.fecha_inicial.slice(0,10)} → ${ev.fecha_final.slice(0,10)}`
                            : ''}
                        </Text>
                        {ev.observacion && (
                          <Text size="xs" c="dimmed" fs="italic" lineClamp={1}>
                            {ev.observacion}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </HoverCard.Dropdown>
              </HoverCard>
            )
          })}
        </SimpleGrid>
      </Card>

      {/* Selected day events */}
      {selectedDate && (
        <Card p="md">
          <Group justify="space-between" mb="md">
            <Text fw={600}>
              Eventos del {format(selectedDate, "d 'de' MMMM yyyy", { locale: es })}
            </Text>
            <Button
              size="xs" variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => handleCreateForDate(selectedDate)}
            >
              Agregar
            </Button>
          </Group>

          {selectedEvents.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">Sin eventos este día</Text>
          ) : (
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Empleado</Table.Th>
                    <Table.Th>Categoría</Table.Th>
                    <Table.Th>Hora</Table.Th>
                    <Table.Th>Creado por</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Observación</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedEvents.map(ev => (
                    <Table.Tr key={ev.id}>
                      <Table.Td>{ev.empleado_nombre ?? `#${ev.empleado_id}`}</Table.Td>
                      <Table.Td>{ev.categoria_nombre ?? `#${ev.categoria_evento_id}`}</Table.Td>
                      <Table.Td>{ev.fecha_inicial.slice(11, 16) || '—'}</Table.Td>
                      <Table.Td>{ev.created_by_nombre ?? '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={estadoColor(ev.estado)} variant="light" size="xs">
                          {ev.estado}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{ev.observacion ?? '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {ev.estado === 'sin_revisar' && (
                            <>
                              <Tooltip label="Aprobar">
                                <ActionIcon
                                  color="green" variant="subtle" size="sm"
                                  onClick={() => aprobarMutation.mutate(ev.id)}
                                  loading={aprobarMutation.isPending}
                                >
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Rechazar">
                                <ActionIcon
                                  color="red" variant="subtle" size="sm"
                                  onClick={() => setRechazarTarget(ev.id)}
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip label="Editar">
                            <ActionIcon
                              color="blue" variant="subtle" size="sm"
                              onClick={() => handleEdit(ev)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Eliminar">
                            <ActionIcon
                              color="red" variant="subtle" size="sm"
                              onClick={() => {
                                if (confirm('¿Eliminar este evento?')) {
                                  deleteMutation.mutate(ev.id)
                                }
                              }}
                              loading={deleteMutation.isPending}
                            >
                              <IconTrash size={14} />
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
        </Card>
      )}

      {/* Modal crear evento */}
      <Modal opened={createOpened} onClose={closeCreate} title="Nuevo evento" size="md">
        <form onSubmit={createForm.handleSubmit((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = { ...d }
          if (!payload.fecha_final) delete payload.fecha_final
          if (!payload.sucursal_id) delete payload.sucursal_id
          if (!payload.observacion) delete payload.observacion
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
              onChange={(v) => createForm.setValue('categoria_evento_id', Number(v))}
            />
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
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal editar evento */}
      <Modal
        opened={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar evento"
        size="md"
      >
        <form onSubmit={editForm.handleSubmit((d) => {
          if (!editTarget) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = { ...d }
          if (!payload.fecha_final) delete payload.fecha_final
          if (!payload.sucursal_id) delete payload.sucursal_id
          if (!payload.observacion) delete payload.observacion
          updateMutation.mutate({ id: editTarget.id, data: payload })
        })}>
          <Stack gap="sm">
            <Select
              label="Empleado *"
              data={(empleados ?? []).map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }))}
              searchable
              value={editForm.watch('empleado_id') ? String(editForm.watch('empleado_id')) : null}
              onChange={(v) => editForm.setValue('empleado_id', Number(v))}
            />
            <Select
              label="Categoría *"
              data={(catEventos ?? []).map(c => ({ value: String(c.id), label: c.nombre }))}
              value={editForm.watch('categoria_evento_id') ? String(editForm.watch('categoria_evento_id')) : null}
              onChange={(v) => editForm.setValue('categoria_evento_id', Number(v))}
            />
            <Group grow>
              <TextInput label="Fecha inicial *" type="datetime-local" {...editForm.register('fecha_inicial')} />
              <TextInput label="Fecha final" type="datetime-local" {...editForm.register('fecha_final')} />
            </Group>
            <Select
              label="Sucursal"
              data={(sucursales ?? []).map(s => ({ value: String(s.id), label: s.nombre }))}
              clearable
              value={editForm.watch('sucursal_id') ? String(editForm.watch('sucursal_id')) : null}
              onChange={(v) => editForm.setValue('sucursal_id', v ? Number(v) : undefined)}
            />
            <Textarea label="Observación" {...editForm.register('observacion')} />
            <Button type="submit" loading={updateMutation.isPending}>Guardar</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal rechazar */}
      <Modal
        opened={rechazarTarget !== null}
        onClose={() => { setRechazarTarget(null); setRechazarMotivo('') }}
        title="Rechazar evento"
        size="sm"
      >
        <Stack gap="sm">
          <Textarea
            label="Motivo *"
            value={rechazarMotivo}
            onChange={(e) => setRechazarMotivo(e.currentTarget.value)}
          />
          <Button
            color="red"
            loading={rechazarMutation.isPending}
            disabled={!rechazarMotivo.trim()}
            onClick={() => {
              if (rechazarTarget && rechazarMotivo.trim()) {
                rechazarMutation.mutate({ id: rechazarTarget, motivo: rechazarMotivo })
              }
            }}
          >
            Rechazar
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
