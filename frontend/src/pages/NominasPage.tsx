import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  Text, Modal, TextInput, Skeleton, ActionIcon, Tooltip,
  Alert, SegmentedControl,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus, IconCalculator, IconList, IconLock, IconCheck, IconX } from '@tabler/icons-react'
import {
  getPeriodos, createPeriodo, calcularNomina, calcularRapido, getNominas,
  getDetallesNomina, cerrarPeriodo, marcarPagado, desmarcarPagado,
} from '../api/nominas'
import type { PeriodoCreate } from '../types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const periodoSchema = z.object({
  tipo: z.enum(['mensual', 'quincenal']),
  fecha_inicio: z.string().min(1),
  fecha_fin: z.string().min(1),
})

type FiltroEstado = 'todos' | 'pendientes' | 'pagados'

export default function NominasPage() {
  const qc = useQueryClient()
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | null>(null)
  const [detalleNominaId, setDetalleNominaId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [periodoOpened, { open: openPeriodo, close: closePeriodo }] = useDisclosure()

  const { data: periodos, isLoading: loadingPeriodos } = useQuery({
    queryKey: ['periodos'],
    queryFn: getPeriodos,
  })

  const { data: nominas, isLoading: loadingNominas } = useQuery({
    queryKey: ['nominas', selectedPeriodo],
    queryFn: () => getNominas(selectedPeriodo!),
    enabled: selectedPeriodo !== null,
  })

  const { data: detalles } = useQuery({
    queryKey: ['nomina-detalles', detalleNominaId],
    queryFn: () => getDetallesNomina(detalleNominaId!),
    enabled: detalleNominaId !== null,
  })

  const periodoMutation = useMutation({
    mutationFn: (data: PeriodoCreate) => createPeriodo(data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['periodos'] })
      notifications.show({ message: 'Período creado', color: 'green' })
      setSelectedPeriodo(p.id)
      closePeriodo()
    },
  })

  const calcularMutation = useMutation({
    mutationFn: () => calcularNomina(selectedPeriodo!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominas', selectedPeriodo] })
      notifications.show({ message: 'Nómina calculada', color: 'green' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => notifications.show({ message: e?.response?.data?.detail ?? 'Error al calcular', color: 'red' }),
  })

  const calcularRapidoMutation = useMutation({
    mutationFn: (modo: 'mes_actual' | 'hasta_hoy') => calcularRapido(modo),
    onSuccess: (data) => {
      setSelectedPeriodo(data.periodo_id)
      qc.invalidateQueries({ queryKey: ['periodos'] })
      qc.invalidateQueries({ queryKey: ['nominas', data.periodo_id] })
      notifications.show({ message: `Nómina calculada (${data.nominas.length} empleados)`, color: 'green' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => notifications.show({ message: e?.response?.data?.detail ?? 'Error al calcular', color: 'red' }),
  })

  const cerrarMutation = useMutation({
    mutationFn: () => cerrarPeriodo(selectedPeriodo!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] })
      notifications.show({ message: 'Período cerrado', color: 'orange' })
    },
  })

  const marcarPagadoMutation = useMutation({
    mutationFn: (id: number) => marcarPagado(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominas', selectedPeriodo] })
      notifications.show({ message: 'Marcado como pagado', color: 'green' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => notifications.show({ message: e?.response?.data?.detail ?? 'Error', color: 'red' }),
  })

  const desmarcarPagadoMutation = useMutation({
    mutationFn: (id: number) => desmarcarPagado(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominas', selectedPeriodo] })
      notifications.show({ message: 'Marcado como pendiente', color: 'orange' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => notifications.show({ message: e?.response?.data?.detail ?? 'Error', color: 'red' }),
  })

  const periodoForm = useForm<z.infer<typeof periodoSchema>>({
    resolver: zodResolver(periodoSchema),
    defaultValues: {
      tipo: 'mensual',
      fecha_inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      fecha_fin: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    },
  })

  const periodoActual = periodos?.find(p => p.id === selectedPeriodo)

  const formatMoney = (n: number | string | null | undefined) => {
    const num = Number(n ?? 0)
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
      .format(Number.isFinite(num) ? num : 0)
  }

  // Estadísticas
  const totalNominas = nominas ?? []
  const pagadas = totalNominas.filter(n => n.pagado)
  const pendientes = totalNominas.filter(n => !n.pagado)
  const totalNeto = totalNominas.reduce((s, n) => s + Number(n.neto_a_pagar ?? 0), 0)
  const totalPagado = pagadas.reduce((s, n) => s + Number(n.monto_pagado ?? n.neto_a_pagar ?? 0), 0)
  const totalPendiente = pendientes.reduce((s, n) => s + Number(n.neto_a_pagar ?? 0), 0)

  // Filtrado
  const nominasFiltradas = totalNominas.filter(n => {
    if (filtroEstado === 'pagados') return n.pagado
    if (filtroEstado === 'pendientes') return !n.pagado
    return true
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Nóminas</Title>
        <Group gap="sm">
          <Tooltip label="Crea o usa el período del 1° al último día del mes actual y calcula">
            <Button
              variant="light"
              color="teal"
              leftSection={<IconCalculator size={16} />}
              loading={calcularRapidoMutation.isPending && calcularRapidoMutation.variables === 'mes_actual'}
              onClick={() => calcularRapidoMutation.mutate('mes_actual')}
            >
              Calcular mes actual
            </Button>
          </Tooltip>
          <Tooltip label="Crea o usa el período del 1° del mes hasta hoy y calcula">
            <Button
              variant="light"
              color="cyan"
              leftSection={<IconCalculator size={16} />}
              loading={calcularRapidoMutation.isPending && calcularRapidoMutation.variables === 'hasta_hoy'}
              onClick={() => calcularRapidoMutation.mutate('hasta_hoy')}
            >
              Calcular hasta hoy
            </Button>
          </Tooltip>
          <Button leftSection={<IconPlus size={16} />} onClick={openPeriodo}>
            Nuevo período
          </Button>
        </Group>
      </Group>

      <Group align="flex-end">
        {loadingPeriodos ? (
          <Skeleton h={36} w={300} />
        ) : (
          <Select
            label="Período"
            data={(periodos ?? []).map(p => ({
              value: String(p.id),
              label: `${p.tipo} | ${p.fecha_inicio} → ${p.fecha_fin} ${p.cerrado ? '(cerrado)' : ''}`,
            }))}
            value={selectedPeriodo ? String(selectedPeriodo) : null}
            onChange={(v) => setSelectedPeriodo(v ? Number(v) : null)}
            w={400}
            clearable
          />
        )}
        {selectedPeriodo && !periodoActual?.cerrado && (
          <>
            <Button
              leftSection={<IconCalculator size={16} />}
              onClick={() => calcularMutation.mutate()}
              loading={calcularMutation.isPending}
            >
              Calcular nómina
            </Button>
            <Tooltip label="Cerrar período (no editable después)">
              <Button
                color="red"
                variant="outline"
                leftSection={<IconLock size={16} />}
                onClick={() => cerrarMutation.mutate()}
              >
                Cerrar período
              </Button>
            </Tooltip>
          </>
        )}
      </Group>

      {selectedPeriodo && totalNominas.length > 0 && (
        <Alert color="blue" variant="light">
          <Group gap="xl" wrap="wrap">
            <Text size="sm">
              <b>{totalNominas.length}</b> empleados · Total: <b>{formatMoney(totalNeto)}</b>
            </Text>
            <Text size="sm" c="green">
              <b>{pagadas.length}</b> pagados · <b>{formatMoney(totalPagado)}</b>
            </Text>
            {pendientes.length > 0 && (
              <Text size="sm" c="orange">
                <b>{pendientes.length}</b> pendientes · <b>{formatMoney(totalPendiente)}</b>
              </Text>
            )}
          </Group>
        </Alert>
      )}

      {selectedPeriodo && totalNominas.length > 0 && (
        <SegmentedControl
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as FiltroEstado)}
          data={[
            { value: 'todos', label: `Todos (${totalNominas.length})` },
            { value: 'pendientes', label: `Pendientes (${pendientes.length})` },
            { value: 'pagados', label: `Pagados (${pagadas.length})` },
          ]}
          w="fit-content"
        />
      )}

      {selectedPeriodo && (
        loadingNominas ? (
          <Skeleton h={300} />
        ) : (
          <Table.ScrollContainer minWidth={750}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Empleado</Table.Th>
                  <Table.Th>Salario base</Table.Th>
                  <Table.Th>Total ingresos</Table.Th>
                  <Table.Th>Deducciones</Table.Th>
                  <Table.Th>Neto a pagar</Table.Th>
                  <Table.Th>Estado pago</Table.Th>
                  <Table.Th>Fecha pago</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {nominasFiltradas.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text c="dimmed" ta="center">
                        {totalNominas.length === 0
                          ? 'Sin nóminas — hacé clic en "Calcular nómina"'
                          : 'Sin resultados para el filtro seleccionado'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {nominasFiltradas.map((n) => (
                  <Table.Tr key={n.id} bg={n.pagado ? 'var(--mantine-color-green-0)' : undefined}>
                    <Table.Td fw={500}>{n.empleado_nombre ?? `Empleado #${n.empleado_id}`}</Table.Td>
                    <Table.Td>{formatMoney(n.salario_base)}</Table.Td>
                    <Table.Td>{formatMoney(n.total_ingresos)}</Table.Td>
                    <Table.Td>{formatMoney(n.total_deducciones)}</Table.Td>
                    <Table.Td fw={700}>{formatMoney(n.neto_a_pagar)}</Table.Td>
                    <Table.Td>
                      {n.pagado ? (
                        <Badge color="green" variant="filled" size="sm">Pagado</Badge>
                      ) : (
                        <Badge color="orange" variant="light" size="sm">Pendiente</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {n.fecha_pago
                        ? <Text size="xs">{new Date(n.fecha_pago).toLocaleDateString('es-AR')}</Text>
                        : <Text size="xs" c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {!n.pagado ? (
                          <Tooltip label="Marcar como pagado">
                            <ActionIcon
                              color="green" variant="light" size="sm"
                              onClick={() => marcarPagadoMutation.mutate(n.id)}
                              loading={marcarPagadoMutation.isPending}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Desmarcar pago">
                            <ActionIcon
                              color="orange" variant="subtle" size="sm"
                              onClick={() => desmarcarPagadoMutation.mutate(n.id)}
                              loading={desmarcarPagadoMutation.isPending}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Ver detalles">
                          <ActionIcon
                            variant="subtle" size="sm"
                            onClick={() => setDetalleNominaId(n.id)}
                          >
                            <IconList size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )
      )}

      {/* Modal nuevo período */}
      <Modal opened={periodoOpened} onClose={closePeriodo} title="Nuevo período de nómina" size="sm">
        <form onSubmit={periodoForm.handleSubmit((d) => periodoMutation.mutate(d))}>
          <Stack gap="sm">
            <Select
              label="Tipo"
              data={[{ value: 'mensual', label: 'Mensual' }, { value: 'quincenal', label: 'Quincenal' }]}
              onChange={(v) => periodoForm.setValue('tipo', v as 'mensual' | 'quincenal')}
            />
            <Group grow>
              <TextInput label="Fecha inicio *" type="date" {...periodoForm.register('fecha_inicio')} />
              <TextInput label="Fecha fin *" type="date" {...periodoForm.register('fecha_fin')} />
            </Group>
            <Button type="submit" loading={periodoMutation.isPending}>Crear período</Button>
          </Stack>
        </form>
      </Modal>

      {/* Modal detalles nómina */}
      <Modal
        opened={detalleNominaId !== null}
        onClose={() => setDetalleNominaId(null)}
        title="Detalle de nómina"
        size="lg"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Concepto</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Cantidad</Table.Th>
              <Table.Th>Unitario</Table.Th>
              <Table.Th>Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(detalles ?? []).map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.concepto_nombre ?? `Concepto #${d.concepto_id}`}</Table.Td>
                <Table.Td>
                  <Badge color={d.tipo === 'ingreso' ? 'green' : 'red'} variant="light" size="xs">
                    {d.tipo}
                  </Badge>
                </Table.Td>
                <Table.Td>{d.cantidad}</Table.Td>
                <Table.Td>{formatMoney(d.monto_unitario)}</Table.Td>
                <Table.Td fw={600}>{formatMoney(d.monto_total)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Modal>
    </Stack>
  )
}
