import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  Text, Modal, TextInput, Skeleton, ActionIcon, Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { getAsistencias, createAsistencia, updateAsistencia, deleteAsistencia } from '../api/asistencias'
import { getEmpleados } from '../api/empleados'
import { format } from 'date-fns'
import type { AsistenciaCreate, Asistencia } from '../types'

const schema = z.object({
  empleado_id: z.coerce.number().min(1, 'Requerido'),
  fecha: z.string().min(1),
  hora_entrada: z.string().optional(),
  hora_salida: z.string().optional(),
  estado: z.enum(['presente', 'tarde', 'ausente']).default('presente'),
})

export default function AsistenciasPage() {
  const qc = useQueryClient()
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editTarget, setEditTarget] = useState<Asistencia | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()

  const { data: asistencias, isLoading } = useQuery({
    queryKey: ['asistencias', fecha],
    queryFn: () => getAsistencias({ fecha }),
    refetchInterval: 30_000,
  })

  const { data: empleados } = useQuery({
    queryKey: ['empleados-activos'],
    queryFn: () => getEmpleados({ activo: true }),
  })

  const createMutation = useMutation({
    mutationFn: (data: AsistenciaCreate) => createAsistencia(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistencias'] })
      notifications.show({ message: 'Asistencia registrada', color: 'green' })
      closeCreate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AsistenciaCreate> }) =>
      updateAsistencia(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistencias'] })
      notifications.show({ message: 'Asistencia actualizada', color: 'green' })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAsistencia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistencias'] })
      notifications.show({ message: 'Asistencia eliminada', color: 'orange' })
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) as any })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) as any })

  const openEdit = (a: Asistencia) => {
    setEditTarget(a)
    editForm.reset({
      empleado_id: a.empleado_id,
      fecha: a.fecha,
      hora_entrada: a.hora_entrada ?? undefined,
      hora_salida: a.hora_salida ?? undefined,
      estado: a.estado,
    })
  }

  const estadoColor = (e: string) =>
    e === 'presente' ? 'green' : e === 'tarde' ? 'yellow' : 'red'

  const presentes = (asistencias ?? []).filter(a => a.estado === 'presente').length
  const tarde = (asistencias ?? []).filter(a => a.estado === 'tarde').length

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Asistencias</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Carga manual
        </Button>
      </Group>

      <Group>
        <TextInput
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.currentTarget.value)}
        />
        <Text size="sm" mt="auto" pb={6} c="dimmed">
          {(asistencias ?? []).length} registros · {presentes} presentes · {tarde} tarde
        </Text>
      </Group>

      {isLoading ? <Skeleton h={300} /> : (
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Empleado</Table.Th>
                <Table.Th>Entrada</Table.Th>
                <Table.Th>Salida</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(asistencias ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}><Text c="dimmed" ta="center">Sin registros para esta fecha</Text></Table.Td>
                </Table.Tr>
              )}
              {(asistencias ?? []).map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>{a.empleado_nombre ?? `#${a.empleado_id}`}</Table.Td>
                  <Table.Td>{a.hora_entrada ?? '—'}</Table.Td>
                  <Table.Td>{a.hora_salida ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={estadoColor(a.estado)} variant="light" size="xs">{a.estado}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(a)}>
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          color="red" variant="subtle" size="sm"
                          onClick={() => deleteMutation.mutate(a.id)}
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

      {/* Modal carga manual */}
      <Modal opened={createOpened} onClose={closeCreate} title="Carga manual de asistencia" size="sm">
        <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d as unknown as AsistenciaCreate))}>
          <Stack gap="sm">
            <Select
              label="Empleado *"
              data={(empleados ?? []).map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }))}
              searchable
              onChange={(v) => createForm.setValue('empleado_id', Number(v))}
            />
            <TextInput label="Fecha *" type="date" defaultValue={fecha} {...createForm.register('fecha')} />
            <Group grow>
              <TextInput label="Hora entrada" type="time" {...createForm.register('hora_entrada')} />
              <TextInput label="Hora salida" type="time" {...createForm.register('hora_salida')} />
            </Group>
            <Select
              label="Estado"
              data={[
                { value: 'presente', label: 'Presente' },
                { value: 'tarde', label: 'Tarde' },
                { value: 'ausente', label: 'Ausente' },
              ]}
              defaultValue="presente"
              onChange={(v) => createForm.setValue('estado', v as 'presente' | 'tarde' | 'ausente')}
            />
            <Button type="submit" loading={createMutation.isPending}>Registrar</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal editar */}
      <Modal
        opened={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar asistencia"
        size="sm"
      >
        <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate({ id: editTarget!.id, data: d }))}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Hora entrada" type="time" {...editForm.register('hora_entrada')} />
              <TextInput label="Hora salida" type="time" {...editForm.register('hora_salida')} />
            </Group>
            <Select
              label="Estado"
              data={[
                { value: 'presente', label: 'Presente' },
                { value: 'tarde', label: 'Tarde' },
                { value: 'ausente', label: 'Ausente' },
              ]}
              defaultValue={editTarget?.estado}
              onChange={(v) => editForm.setValue('estado', v as 'presente' | 'tarde' | 'ausente')}
            />
            <Button type="submit" loading={updateMutation.isPending}>Guardar</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
