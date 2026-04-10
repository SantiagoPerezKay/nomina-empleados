import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  ActionIcon, Text, Modal, Textarea, Tooltip, Skeleton,
  TextInput,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus, IconCheck, IconX, IconHistory } from '@tabler/icons-react'
import { getEventos, createEvento, aprobarEvento, rechazarEvento, getHistorialEvento } from '../api/eventos'
import { getCatEventos, getSucursales } from '../api/general'
import { getEmpleados } from '../api/empleados'
import type { EventoCreate } from '../types'
import { format } from 'date-fns'

const createSchema = z.object({
  empleado_id: z.coerce.number().min(1, 'Requerido'),
  categoria_evento_id: z.coerce.number().min(1, 'Requerido'),
  fecha_inicial: z.string().min(1),
  fecha_final: z.string().optional(),
  observacion: z.string().optional(),
  sucursal_id: z.coerce.number().optional(),
})

const rechazarSchema = z.object({ motivo: z.string().min(1, 'Requerido') })

export default function EventosPage() {
  const qc = useQueryClient()
  const [filtroEstado, setFiltroEstado] = useState<string>('sin_revisar')
  const [rechazarTarget, setRechazarTarget] = useState<number | null>(null)
  const [historialTarget, setHistorialTarget] = useState<number | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()

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
    defaultValues: { fecha_inicial: format(new Date(), "yyyy-MM-dd'T'HH:mm") },
  })
  const rechazarForm = useForm<z.infer<typeof rechazarSchema>>({ resolver: zodResolver(rechazarSchema) })

  const estadoColor = (e: string) =>
    e === 'aprobado' ? 'green' : e === 'rechazado' ? 'red' : e === 'actualizado' ? 'blue' : 'orange'

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Eventos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Nuevo evento
        </Button>
      </Group>

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
                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">Sin eventos</Text></Table.Td></Table.Tr>
              )}
              {(eventos ?? []).map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{e.empleado_nombre ?? `#${e.empleado_id}`}</Table.Td>
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

      {/* Modal nuevo evento */}
      <Modal opened={createOpened} onClose={closeCreate} title="Nuevo evento" size="md">
        <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d as unknown as EventoCreate))}>
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
