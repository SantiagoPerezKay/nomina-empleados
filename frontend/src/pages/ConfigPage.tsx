import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Tabs, Table, Button, Group, Modal,
  TextInput, Select, ActionIcon, Badge, Skeleton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import {
  getSucursales, createSucursal, updateSucursal, deleteSucursal,
  getDepartamentos, createDepartamento, deleteDepartamento,
  getTurnos, createTurno, deleteTurno,
  getConceptos, createConcepto, deleteConcepto,
  getCatEventos,
} from '../api/general'
import type { Sucursal } from '../types'

// ── Sucursales ────────────────────────────────────────────────────────────────
function SucursalesTab() {
  const qc = useQueryClient()
  const [editTarget, setEditTarget] = useState<Sucursal | null>(null)
  const [opened, { open, close }] = useDisclosure()
  const { data, isLoading } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })

  const form = useForm<{ nombre: string; ciudad: string; telefono: string }>()

  const createMutation = useMutation({
    mutationFn: (d: { nombre: string }) => createSucursal(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sucursales'] }); notifications.show({ message: 'Creada', color: 'green' }); close() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Record<string, string | undefined> }) => updateSucursal(id, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sucursales'] }); notifications.show({ message: 'Actualizada', color: 'green' }); setEditTarget(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSucursal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sucursales'] }); notifications.show({ message: 'Eliminada', color: 'orange' }) },
  })

  const openEdit = (s: Sucursal) => { setEditTarget(s); form.reset({ nombre: s.nombre, ciudad: s.ciudad ?? '', telefono: s.telefono ?? '' }) }

  return (
    <Stack gap="sm" pt="sm">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { form.reset(); open() }}>
          Nueva sucursal
        </Button>
      </Group>
      {isLoading ? <Skeleton h={150} /> : (
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>Nombre</Table.Th><Table.Th>Ciudad</Table.Th><Table.Th>Tel</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(data ?? []).map(s => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.nombre}</Table.Td>
                <Table.Td>{s.ciudad ?? '—'}</Table.Td>
                <Table.Td>{s.telefono ?? '—'}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(s)}><IconEdit size={14} /></ActionIcon>
                    <ActionIcon color="red" variant="subtle" size="sm" onClick={() => deleteMutation.mutate(s.id)}><IconTrash size={14} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Modal opened={opened} onClose={close} title="Nueva sucursal" size="sm">
        <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))}>
          <Stack gap="sm">
            <TextInput label="Nombre *" {...form.register('nombre', { required: true })} />
            <TextInput label="Ciudad" {...form.register('ciudad')} />
            <TextInput label="Teléfono" {...form.register('telefono')} />
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>
      <Modal opened={editTarget !== null} onClose={() => setEditTarget(null)} title="Editar sucursal" size="sm">
        <form onSubmit={form.handleSubmit(d => updateMutation.mutate({ id: editTarget!.id, d }))}>
          <Stack gap="sm">
            <TextInput label="Nombre *" {...form.register('nombre')} />
            <TextInput label="Ciudad" {...form.register('ciudad')} />
            <TextInput label="Teléfono" {...form.register('telefono')} />
            <Button type="submit" loading={updateMutation.isPending}>Guardar</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

// ── Departamentos ─────────────────────────────────────────────────────────────
function DepartamentosTab() {
  const qc = useQueryClient()
  const [opened, { open, close }] = useDisclosure()
  const { data, isLoading } = useQuery({ queryKey: ['departamentos'], queryFn: getDepartamentos })
  const form = useForm<{ nombre: string }>()
  const createMutation = useMutation({
    mutationFn: (d: { nombre: string }) => createDepartamento(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); notifications.show({ message: 'Creado', color: 'green' }); close() },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDepartamento(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); notifications.show({ message: 'Eliminado', color: 'orange' }) },
  })
  return (
    <Stack gap="sm" pt="sm">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { form.reset(); open() }}>Nuevo</Button>
      </Group>
      {isLoading ? <Skeleton h={150} /> : (
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>Nombre</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(data ?? []).map(d => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.nombre}</Table.Td>
                <Table.Td>
                  <ActionIcon color="red" variant="subtle" size="sm" onClick={() => deleteMutation.mutate(d.id)}><IconTrash size={14} /></ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Modal opened={opened} onClose={close} title="Nuevo departamento" size="sm">
        <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))}>
          <Stack gap="sm">
            <TextInput label="Nombre *" {...form.register('nombre', { required: true })} />
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

// ── Turnos ────────────────────────────────────────────────────────────────────
function TurnosTab() {
  const qc = useQueryClient()
  const [opened, { open, close }] = useDisclosure()
  const { data, isLoading } = useQuery({ queryKey: ['turnos'], queryFn: getTurnos })
  const form = useForm<{ nombre: string; hora_entrada: string; hora_salida: string; tolerancia_min: number }>()
  const createMutation = useMutation({
    mutationFn: (d: { nombre: string; hora_entrada: string; hora_salida: string; tolerancia_min: number }) => createTurno(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['turnos'] }); notifications.show({ message: 'Creado', color: 'green' }); close() },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTurno(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['turnos'] }); notifications.show({ message: 'Eliminado', color: 'orange' }) },
  })
  return (
    <Stack gap="sm" pt="sm">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { form.reset({ tolerancia_min: 10 }); open() }}>Nuevo</Button>
      </Group>
      {isLoading ? <Skeleton h={150} /> : (
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>Nombre</Table.Th><Table.Th>Entrada</Table.Th><Table.Th>Salida</Table.Th><Table.Th>Tolerancia</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(data ?? []).map(t => (
              <Table.Tr key={t.id}>
                <Table.Td>{t.nombre}</Table.Td>
                <Table.Td>{t.hora_entrada}</Table.Td>
                <Table.Td>{t.hora_salida}</Table.Td>
                <Table.Td>{t.tolerancia_min} min</Table.Td>
                <Table.Td>
                  <ActionIcon color="red" variant="subtle" size="sm" onClick={() => deleteMutation.mutate(t.id)}><IconTrash size={14} /></ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Modal opened={opened} onClose={close} title="Nuevo turno" size="sm">
        <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))}>
          <Stack gap="sm">
            <TextInput label="Nombre *" {...form.register('nombre', { required: true })} />
            <Group grow>
              <TextInput label="Hora entrada *" type="time" {...form.register('hora_entrada', { required: true })} />
              <TextInput label="Hora salida *" type="time" {...form.register('hora_salida', { required: true })} />
            </Group>
            <TextInput label="Tolerancia (min)" type="number" {...form.register('tolerancia_min')} defaultValue={10} />
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

// ── Conceptos de nómina ───────────────────────────────────────────────────────
function ConceptosTab() {
  const qc = useQueryClient()
  const [opened, { open, close }] = useDisclosure()
  const { data, isLoading } = useQuery({ queryKey: ['conceptos'], queryFn: getConceptos })
  const form = useForm<{ codigo: string; nombre: string; tipo: string; categoria: string; porcentaje: number; monto_fijo: number }>()
  const createMutation = useMutation({
    mutationFn: (d: any) => createConcepto(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos'] }); notifications.show({ message: 'Creado', color: 'green' }); close() },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteConcepto(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos'] }); notifications.show({ message: 'Eliminado', color: 'orange' }) },
  })
  return (
    <Stack gap="sm" pt="sm">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { form.reset(); open() }}>Nuevo</Button>
      </Group>
      {isLoading ? <Skeleton h={200} /> : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Categoría</Table.Th>
              <Table.Th>%</Table.Th>
              <Table.Th>Fijo</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data ?? []).map(c => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.codigo}</Table.Td>
                <Table.Td>{c.nombre}</Table.Td>
                <Table.Td>
                  <Badge color={c.tipo === 'ingreso' ? 'green' : 'red'} variant="light" size="xs">{c.tipo}</Badge>
                </Table.Td>
                <Table.Td>{c.categoria}</Table.Td>
                <Table.Td>{c.porcentaje ?? '—'}</Table.Td>
                <Table.Td>{c.monto_fijo ? `$${c.monto_fijo}` : '—'}</Table.Td>
                <Table.Td>
                  <ActionIcon color="red" variant="subtle" size="sm" onClick={() => deleteMutation.mutate(c.id)}><IconTrash size={14} /></ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Modal opened={opened} onClose={close} title="Nuevo concepto" size="sm">
        <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Código *" {...form.register('codigo', { required: true })} />
              <TextInput label="Nombre *" {...form.register('nombre', { required: true })} />
            </Group>
            <Select
              label="Tipo"
              data={[{ value: 'ingreso', label: 'Ingreso' }, { value: 'deduccion', label: 'Deducción' }]}
              onChange={(v) => form.setValue('tipo', v ?? 'ingreso')}
            />
            <Select
              label="Categoría"
              data={['salario_base', 'horas_extras', 'bono', 'comision', 'aguinaldo', 'vacaciones', 'adelanto', 'ausencia', 'llegada_tarde', 'aporte_social', 'impuesto', 'otro'].map(v => ({ value: v, label: v }))}
              onChange={(v) => form.setValue('categoria', v ?? 'otro')}
            />
            <Group grow>
              <TextInput label="Porcentaje" type="number" step="0.01" {...form.register('porcentaje')} />
              <TextInput label="Monto fijo" type="number" step="0.01" {...form.register('monto_fijo')} />
            </Group>
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

// ── Categorías de evento ──────────────────────────────────────────────────────
function CatEventosTab() {
  const { data, isLoading } = useQuery({ queryKey: ['cat-eventos'], queryFn: getCatEventos })
  return (
    <Stack gap="sm" pt="sm">
      {isLoading ? <Skeleton h={150} /> : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Req. aprobación</Table.Th>
              <Table.Th>Afecta nómina</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data ?? []).map(c => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.codigo}</Table.Td>
                <Table.Td>{c.nombre}</Table.Td>
                <Table.Td><Badge color={c.requiere_aprobacion ? 'orange' : 'gray'} variant="light" size="xs">{c.requiere_aprobacion ? 'Sí' : 'No'}</Badge></Table.Td>
                <Table.Td><Badge color={c.afecta_nomina ? 'blue' : 'gray'} variant="light" size="xs">{c.afecta_nomina ? 'Sí' : 'No'}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConfigPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Configuración</Title>
      <Tabs defaultValue="sucursales">
        <Tabs.List>
          <Tabs.Tab value="sucursales">Sucursales</Tabs.Tab>
          <Tabs.Tab value="departamentos">Departamentos</Tabs.Tab>
          <Tabs.Tab value="turnos">Turnos</Tabs.Tab>
          <Tabs.Tab value="conceptos">Conceptos nómina</Tabs.Tab>
          <Tabs.Tab value="cat-eventos">Categorías evento</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="sucursales"><SucursalesTab /></Tabs.Panel>
        <Tabs.Panel value="departamentos"><DepartamentosTab /></Tabs.Panel>
        <Tabs.Panel value="turnos"><TurnosTab /></Tabs.Panel>
        <Tabs.Panel value="conceptos"><ConceptosTab /></Tabs.Panel>
        <Tabs.Panel value="cat-eventos"><CatEventosTab /></Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
