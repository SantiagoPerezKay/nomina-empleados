import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Stack, Title, Group, Button, Select, Table, Badge,
  Text, Modal, TextInput, Skeleton, ActionIcon, Tooltip,
  Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus, IconCalculator, IconList, IconLock } from '@tabler/icons-react'
import {
  getPeriodos, createPeriodo, calcularNomina, getNominas,
  getDetallesNomina, cerrarPeriodo,
} from '../api/nominas'
import type { PeriodoCreate } from '../types'

const periodoSchema = z.object({
  tipo: z.enum(['mensual', 'quincenal']),
  fecha_inicio: z.string().min(1),
  fecha_fin: z.string().min(1),
})

export default function NominasPage() {
  const qc = useQueryClient()
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | null>(null)
  const [detalleNominaId, setDetalleNominaId] = useState<number | null>(null)
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
    onError: (e: any) => notifications.show({ message: e?.response?.data?.detail ?? 'Error al calcular', color: 'red' }),
  })

  const cerrarMutation = useMutation({
    mutationFn: () => cerrarPeriodo(selectedPeriodo!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periodos'] })
      notifications.show({ message: 'Período cerrado', color: 'orange' })
    },
  })

  const periodoForm = useForm<z.infer<typeof periodoSchema>>({ resolver: zodResolver(periodoSchema) })

  const periodoActual = periodos?.find(p => p.id === selectedPeriodo)
  const totalNeto = (nominas ?? []).reduce((sum, n) => sum + n.neto_a_pagar, 0)

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Nóminas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openPeriodo}>
          Nuevo período
        </Button>
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

      {selectedPeriodo && nominas && nominas.length > 0 && (
        <Alert color="blue" variant="light">
          {nominas.length} empleados · Total neto: <b>{formatMoney(totalNeto)}</b>
        </Alert>
      )}

      {selectedPeriodo && (
        loadingNominas ? (
          <Skeleton h={300} />
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Empleado</Table.Th>
                  <Table.Th>Salario base</Table.Th>
                  <Table.Th>Total ingresos</Table.Th>
                  <Table.Th>Deducciones</Table.Th>
                  <Table.Th>Neto a pagar</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(nominas ?? []).length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center">
                        Sin nóminas — haz clic en "Calcular nómina"
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {(nominas ?? []).map((n) => (
                  <Table.Tr key={n.id}>
                    <Table.Td>{n.empleado_nombre ?? `Empleado #${n.empleado_id}`}</Table.Td>
                    <Table.Td>{formatMoney(n.salario_base)}</Table.Td>
                    <Table.Td>{formatMoney(n.total_ingresos)}</Table.Td>
                    <Table.Td>{formatMoney(n.total_deducciones)}</Table.Td>
                    <Table.Td fw={700}>{formatMoney(n.neto_a_pagar)}</Table.Td>
                    <Table.Td>
                      <Tooltip label="Ver detalles">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => setDetalleNominaId(n.id)}
                        >
                          <IconList size={16} />
                        </ActionIcon>
                      </Tooltip>
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
