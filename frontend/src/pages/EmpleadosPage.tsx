import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Stack, Title, Group, Button, TextInput, Select,
  Table, Badge, ActionIcon, Text, Modal, Skeleton,
  Tooltip, Checkbox,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconSearch, IconPlus, IconEye, IconDoorExit, IconEdit } from '@tabler/icons-react'
import { getEmpleados, createEmpleado, updateEmpleado, egresar } from '../api/empleados'
import { getSucursales, getDepartamentos, getCatEgresos } from '../api/general'
import type { EmpleadoCreate, EmpleadoUpdate, EgresoRequest } from '../types'

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

export default function EmpleadosPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filtroBaja, setFiltroBaja] = useState<string>('true')
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()
  const [editTarget, setEditTarget] = useState<number | null>(null)
  const [egresoTarget, setEgresoTarget] = useState<number | null>(null)

  const { data: empleados, isLoading } = useQuery({
    queryKey: ['empleados', filtroBaja],
    queryFn: () => getEmpleados({ activo: filtroBaja === 'true' ? true : filtroBaja === 'false' ? false : undefined }),
  })
  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: departamentos } = useQuery({ queryKey: ['departamentos'], queryFn: getDepartamentos })
  const { data: catEgresos } = useQuery({ queryKey: ['cat-egresos'], queryFn: getCatEgresos })

  const createMutation = useMutation({
    mutationFn: (data: EmpleadoCreate) => createEmpleado(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado creado', color: 'green' })
      closeCreate()
      createForm.reset()
    },
    onError: () => notifications.show({ message: 'Error al crear empleado', color: 'red' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmpleadoUpdate }) => updateEmpleado(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado actualizado', color: 'green' })
      setEditTarget(null)
    },
    onError: () => notifications.show({ message: 'Error al actualizar', color: 'red' }),
  })

  const egresoMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EgresoRequest }) => egresar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] })
      notifications.show({ message: 'Empleado egresado', color: 'orange' })
      setEgresoTarget(null)
    },
    onError: () => notifications.show({ message: 'Error al egresar', color: 'red' }),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) as any })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) as any })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const egresoForm = useForm<z.infer<typeof egresoSchema>>({ resolver: zodResolver(egresoSchema) as any })

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
                        <ActionIcon
                          component={Link}
                          to={`/empleados/${emp.id}`}
                          variant="subtle"
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Editar">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => openEditModal(emp)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {emp.activo && (
                        <Tooltip label="Egresar">
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => { setEgresoTarget(emp.id); egresoForm.reset() }}
                          >
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

      {/* Modal crear empleado */}
      <Modal opened={createOpened} onClose={closeCreate} title="Nuevo empleado" size="md">
        <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d as unknown as EmpleadoCreate))}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Nombre *" {...createForm.register('nombre')} error={createForm.formState.errors.nombre?.message} />
              <TextInput label="Apellido *" {...createForm.register('apellido')} error={createForm.formState.errors.apellido?.message} />
            </Group>
            <Group grow>
              <TextInput label="Fecha ingreso *" type="date" {...createForm.register('fecha_ingreso')} error={createForm.formState.errors.fecha_ingreso?.message} />
              <TextInput label="Nro vendedor" type="number" {...createForm.register('nro_vendedor')} />
            </Group>
            <Group grow>
              <TextInput label="Documento" {...createForm.register('documento')} />
              <TextInput label="Email" type="email" {...createForm.register('email')} />
            </Group>
            <TextInput label="Teléfono" {...createForm.register('telefono')} />
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
            <Checkbox
              label="En blanco (sin aportes jubilatorios ni obra social)"
              checked={createForm.watch('en_blanco') ?? false}
              onChange={(e) => createForm.setValue('en_blanco', e.currentTarget.checked)}
            />
            <Button type="submit" loading={createMutation.isPending}>Crear</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal editar empleado */}
      <Modal
        opened={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar empleado"
        size="md"
      >
        <form onSubmit={editForm.handleSubmit((d) => {
          const payload: EmpleadoUpdate = { ...d }
          if (!payload.nro_vendedor) delete payload.nro_vendedor
          if (!payload.email) delete payload.email
          editMutation.mutate({ id: editTarget!, data: payload })
        })}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Nombre *" {...editForm.register('nombre')} error={editForm.formState.errors.nombre?.message} />
              <TextInput label="Apellido *" {...editForm.register('apellido')} error={editForm.formState.errors.apellido?.message} />
            </Group>
            <Group grow>
              <TextInput label="Nro vendedor" type="number" {...editForm.register('nro_vendedor')} />
              <TextInput label="Documento" {...editForm.register('documento')} />
            </Group>
            <Group grow>
              <TextInput label="Email" type="email" {...editForm.register('email')} />
              <TextInput label="Teléfono" {...editForm.register('telefono')} />
            </Group>
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
            <Checkbox
              label="En blanco (sin aportes jubilatorios ni obra social)"
              checked={editForm.watch('en_blanco') ?? false}
              onChange={(e) => editForm.setValue('en_blanco', e.currentTarget.checked)}
            />
            <Button type="submit" loading={editMutation.isPending}>Guardar cambios</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal egresar */}
      <Modal
        opened={egresoTarget !== null}
        onClose={() => setEgresoTarget(null)}
        title="Registrar egreso"
        size="sm"
      >
        <form onSubmit={egresoForm.handleSubmit((d) => egresoMutation.mutate({ id: egresoTarget!, data: d }))}>
          <Stack gap="sm">
            <TextInput
              label="Fecha egreso *"
              type="date"
              {...egresoForm.register('fecha_egreso')}
              error={egresoForm.formState.errors.fecha_egreso?.message}
            />
            <Select
              label="Categoría de egreso *"
              data={(catEgresos ?? []).map(c => ({ value: String(c.id), label: `${c.nombre} (${c.tipo})` }))}
              onChange={(v) => egresoForm.setValue('categoria_egreso_id', v ? Number(v) : 0)}
              error={egresoForm.formState.errors.categoria_egreso_id?.message}
            />
            <TextInput label="Motivo (opcional)" {...egresoForm.register('motivo_egreso')} />
            <Button type="submit" color="red" loading={egresoMutation.isPending}>
              Registrar egreso
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
