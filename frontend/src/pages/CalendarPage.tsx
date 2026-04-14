import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  Modal, Textarea, Text, Card, ActionIcon, Tooltip,
  Box, SimpleGrid, UnstyledButton, TextInput,
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
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
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

  // Map events to dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventoEmpleado[]>()
    for (const ev of eventos ?? []) {
      const dateKey = ev.fecha_inicial.slice(0, 10)
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(ev)
    }
    return map
  }, [eventos])

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

            return (
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
                  {dayEvents.slice(0, 3).map(ev => (
                    <Box
                      key={ev.id}
                      px={4} py={1}
                      style={{
                        borderRadius: 4,
                        backgroundColor: `var(--mantine-color-${estadoColor(ev.estado)}-light)`,
                        overflow: 'hidden',
                      }}
                    >
                      <Text size="xs" truncate lh={1.3}>
                        {ev.empleado_nombre ?? `#${ev.empleado_id}`}
                      </Text>
                    </Box>
                  ))}
                  {dayEvents.length > 3 && (
                    <Text size="xs" c="dimmed" ta="center">+{dayEvents.length - 3} más</Text>
                  )}
                </Stack>
              </UnstyledButton>
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
