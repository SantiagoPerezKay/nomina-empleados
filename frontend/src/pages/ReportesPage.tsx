import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Stack, Title, Tabs, Group, Button, Select, Table,
  TextInput, Skeleton,
} from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import {
  getReporteNomina, getReporteAsistencias,
  getReporteEgresos, getReporteEmpleadosActivos,
  getReporteVacaciones,
} from '../api/reportes'
import { getPeriodos } from '../api/nominas'
import { getSucursales, getDepartamentos } from '../api/general'
import { format } from 'date-fns'

function downloadCSV(rows: object[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String((r as Record<string, unknown>)[h] ?? '')
        return v.includes(',') ? `"${v}"` : v
      }).join(',')
    ),
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
}

const hoy = format(new Date(), 'yyyy-MM-dd')
const hace30 = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')

export default function ReportesPage() {
  const [sucursalFiltro, setSucursalFiltro] = useState<number | undefined>()
  const [deptFiltro, setDeptFiltro] = useState<number | undefined>()
  const [periodoFiltro, setPeriodoFiltro] = useState<number | undefined>()
  const [fechaDesde, setFechaDesde] = useState(hace30)
  const [fechaHasta, setFechaHasta] = useState(hoy)

  const { data: sucursales } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales })
  const { data: departamentos } = useQuery({ queryKey: ['departamentos'], queryFn: getDepartamentos })
  const { data: periodos } = useQuery({ queryKey: ['periodos'], queryFn: getPeriodos })

  const { data: reporteNomina, isLoading: loadingNomina } = useQuery({
    queryKey: ['reporte-nomina', periodoFiltro, sucursalFiltro],
    queryFn: () => getReporteNomina(periodoFiltro!, sucursalFiltro),
    enabled: periodoFiltro !== undefined,
  })

  const { data: reporteAsistencias, isLoading: loadingAsist, refetch: refetchAsist } = useQuery({
    queryKey: ['reporte-asistencias', fechaDesde, fechaHasta, sucursalFiltro],
    queryFn: () => getReporteAsistencias(fechaDesde, fechaHasta, sucursalFiltro),
    enabled: false,
  })

  const { data: reporteEgresos, isLoading: loadingEgr, refetch: refetchEgr } = useQuery({
    queryKey: ['reporte-egresos', fechaDesde, fechaHasta, sucursalFiltro],
    queryFn: () => getReporteEgresos(fechaDesde, fechaHasta, sucursalFiltro),
    enabled: false,
  })

  const { data: reporteActivos, isLoading: loadingActivos } = useQuery({
    queryKey: ['reporte-activos', sucursalFiltro, deptFiltro],
    queryFn: () => getReporteEmpleadosActivos(sucursalFiltro, deptFiltro),
  })

  const { data: reporteVacaciones, isLoading: loadingVac } = useQuery({
    queryKey: ['reporte-vacaciones', sucursalFiltro],
    queryFn: () => getReporteVacaciones(undefined, sucursalFiltro),
  })

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

  return (
    <Stack gap="md">
      <Title order={2}>Reportes</Title>

      {/* Filtros comunes */}
      <Group wrap="wrap">
        <Select
          label="Sucursal"
          placeholder="Todas"
          data={(sucursales ?? []).map(s => ({ value: String(s.id), label: s.nombre }))}
          clearable
          onChange={(v) => setSucursalFiltro(v ? Number(v) : undefined)}
          w={180}
        />
        <Select
          label="Departamento"
          placeholder="Todos"
          data={(departamentos ?? []).map(d => ({ value: String(d.id), label: d.nombre }))}
          clearable
          onChange={(v) => setDeptFiltro(v ? Number(v) : undefined)}
          w={180}
        />
      </Group>

      <Tabs defaultValue="nomina">
        <Tabs.List>
          <Tabs.Tab value="nomina">Nómina por período</Tabs.Tab>
          <Tabs.Tab value="asistencias">Asistencias</Tabs.Tab>
          <Tabs.Tab value="egresos">Egresos</Tabs.Tab>
          <Tabs.Tab value="activos">Plantel activo</Tabs.Tab>
          <Tabs.Tab value="vacaciones">Vacaciones</Tabs.Tab>
        </Tabs.List>

        {/* Nómina por período */}
        <Tabs.Panel value="nomina" pt="md">
          <Group mb="md">
            <Select
              label="Período"
              data={(periodos ?? []).map(p => ({ value: String(p.id), label: `${p.tipo} ${p.fecha_inicio} → ${p.fecha_fin}` }))}
              onChange={(v) => setPeriodoFiltro(v ? Number(v) : undefined)}
              w={350}
            />
            {reporteNomina && (
              <Button
                variant="outline"
                leftSection={<IconDownload size={14} />}
                mt="auto"
                onClick={() => downloadCSV(reporteNomina, `nomina_periodo_${periodoFiltro}.csv`)}
              >
                CSV
              </Button>
            )}
          </Group>
          {loadingNomina ? <Skeleton h={200} /> : (
            <Table.ScrollContainer minWidth={700}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Apellido</Table.Th>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Salario base</Table.Th>
                    <Table.Th>Ingresos</Table.Th>
                    <Table.Th>Deducciones</Table.Th>
                    <Table.Th>Neto</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(reporteNomina ?? []).map(r => (
                    <Table.Tr key={r.empleado_id}>
                      <Table.Td>{r.apellido}</Table.Td>
                      <Table.Td>{r.nombre}</Table.Td>
                      <Table.Td>{formatMoney(Number(r.salario_base))}</Table.Td>
                      <Table.Td>{formatMoney(Number(r.total_ingresos))}</Table.Td>
                      <Table.Td>{formatMoney(Number(r.total_deducciones))}</Table.Td>
                      <Table.Td fw={700}>{formatMoney(Number(r.neto_a_pagar))}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        {/* Asistencias */}
        <Tabs.Panel value="asistencias" pt="md">
          <Group mb="md" align="flex-end">
            <TextInput label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.currentTarget.value)} />
            <TextInput label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.currentTarget.value)} />
            <Button onClick={() => refetchAsist()} loading={loadingAsist}>Generar</Button>
            {reporteAsistencias && (
              <Button
                variant="outline"
                leftSection={<IconDownload size={14} />}
                onClick={() => downloadCSV(reporteAsistencias, `asistencias_${fechaDesde}_${fechaHasta}.csv`)}
              >
                CSV
              </Button>
            )}
          </Group>
          <Table.ScrollContainer minWidth={600}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Apellido</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Presentes</Table.Th>
                  <Table.Th>Tarde</Table.Th>
                  <Table.Th>Ausentes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(reporteAsistencias ?? []).map(r => (
                  <Table.Tr key={r.empleado_id}>
                    <Table.Td>{r.apellido}</Table.Td>
                    <Table.Td>{r.nombre}</Table.Td>
                    <Table.Td>{r.dias_presentes}</Table.Td>
                    <Table.Td>{r.dias_tarde}</Table.Td>
                    <Table.Td>{r.dias_ausente}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Egresos */}
        <Tabs.Panel value="egresos" pt="md">
          <Group mb="md" align="flex-end">
            <TextInput label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.currentTarget.value)} />
            <TextInput label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.currentTarget.value)} />
            <Button onClick={() => refetchEgr()} loading={loadingEgr}>Generar</Button>
            {reporteEgresos && (
              <Button
                variant="outline"
                leftSection={<IconDownload size={14} />}
                onClick={() => downloadCSV(reporteEgresos, `egresos_${fechaDesde}_${fechaHasta}.csv`)}
              >
                CSV
              </Button>
            )}
          </Group>
          <Table.ScrollContainer minWidth={600}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Apellido</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Ingreso</Table.Th>
                  <Table.Th>Egreso</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                  <Table.Th>Sucursal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(reporteEgresos ?? []).map(r => (
                  <Table.Tr key={r.empleado_id}>
                    <Table.Td>{r.apellido}</Table.Td>
                    <Table.Td>{r.nombre}</Table.Td>
                    <Table.Td>{r.fecha_ingreso}</Table.Td>
                    <Table.Td>{r.fecha_egreso}</Table.Td>
                    <Table.Td>{r.motivo_egreso ?? '—'}</Table.Td>
                    <Table.Td>{r.sucursal ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* Plantel activo */}
        <Tabs.Panel value="activos" pt="md">
          <Group mb="md" justify="flex-end">
            {reporteActivos && (
              <Button
                variant="outline"
                leftSection={<IconDownload size={14} />}
                onClick={() => downloadCSV(reporteActivos, 'plantel_activo.csv')}
              >
                CSV
              </Button>
            )}
          </Group>
          {loadingActivos ? <Skeleton h={200} /> : (
            <Table.ScrollContainer minWidth={700}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Apellido</Table.Th>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Sucursal</Table.Th>
                    <Table.Th>Ingreso</Table.Th>
                    <Table.Th>Contrato</Table.Th>
                    <Table.Th>Salario</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(reporteActivos ?? []).map(r => (
                    <Table.Tr key={r.empleado_id}>
                      <Table.Td>{r.apellido}</Table.Td>
                      <Table.Td>{r.nombre}</Table.Td>
                      <Table.Td>{r.sucursal ?? '—'}</Table.Td>
                      <Table.Td>{r.fecha_ingreso}</Table.Td>
                      <Table.Td>{r.tipo_contrato ?? '—'}</Table.Td>
                      <Table.Td>
                        {r.salario_mensual
                          ? formatMoney(r.salario_mensual)
                          : r.tarifa_hora
                            ? `$${r.tarifa_hora}/h`
                            : '—'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        {/* Vacaciones */}
        <Tabs.Panel value="vacaciones" pt="md">
          <Group mb="md" justify="flex-end">
            {reporteVacaciones && (
              <Button
                variant="outline"
                leftSection={<IconDownload size={14} />}
                onClick={() => downloadCSV(reporteVacaciones, 'vacaciones.csv')}
              >
                CSV
              </Button>
            )}
          </Group>
          {loadingVac ? <Skeleton h={200} /> : (
            <Table.ScrollContainer minWidth={800}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Apellido</Table.Th>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Sucursal</Table.Th>
                    <Table.Th>Ingreso</Table.Th>
                    <Table.Th>Antigüedad</Table.Th>
                    <Table.Th>Corresponden</Table.Th>
                    <Table.Th>Tomados</Table.Th>
                    <Table.Th>Pendientes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(reporteVacaciones ?? []).map(r => (
                    <Table.Tr key={r.empleado_id}>
                      <Table.Td>{r.apellido}</Table.Td>
                      <Table.Td>{r.nombre}</Table.Td>
                      <Table.Td>{r.sucursal ?? '—'}</Table.Td>
                      <Table.Td>{r.fecha_ingreso}</Table.Td>
                      <Table.Td>{r.antiguedad_anios} año{r.antiguedad_anios !== 1 ? 's' : ''}</Table.Td>
                      <Table.Td>{r.dias_correspondientes}</Table.Td>
                      <Table.Td>{r.dias_tomados}</Table.Td>
                      <Table.Td fw={700} c={r.dias_pendientes > 0 ? 'orange' : 'green'}>
                        {r.dias_pendientes}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
