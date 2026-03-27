import { useQuery } from '@tanstack/react-query'
import {
  Grid, Card, Text, Title, Group, Stack, Badge,
  SimpleGrid, Skeleton, Alert,
} from '@mantine/core'
import {
  IconUsers, IconCurrencyDollar, IconAlertCircle,
  IconClockHour4, IconUserOff,
} from '@tabler/icons-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getKPIs, getNominasPorSucursal } from '../api/dashboard'
import { getEventosPendientes } from '../api/eventos'

function KPICard({ title, value, icon: Icon, color }: {
  title: string; value: string | number; icon: React.ElementType; color: string
}) {
  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Group justify="space-between">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{title}</Text>
          <Text size="xl" fw={700}>{value}</Text>
        </Stack>
        <Icon size={32} color={`var(--mantine-color-${color}-6)`} />
      </Group>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: getKPIs,
    refetchInterval: 60_000,
  })

  const { data: nominasSucursal, isLoading: loadingNominas } = useQuery({
    queryKey: ['dashboard-nominas-sucursal'],
    queryFn: () => getNominasPorSucursal(),
  })

  const { data: pendientes } = useQuery({
    queryKey: ['eventos-pendientes'],
    queryFn: getEventosPendientes,
  })

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard</Title>

      {/* KPIs */}
      {loadingKpis ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={90} radius="md" />)}
        </SimpleGrid>
      ) : kpis ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }}>
          <KPICard title="Empleados activos" value={kpis.total_empleados_activos} icon={IconUsers} color="blue" />
          <KPICard title="Nómina mes actual" value={formatMoney(kpis.total_nomina_mes_actual)} icon={IconCurrencyDollar} color="green" />
          <KPICard title="Eventos pendientes" value={kpis.eventos_pendientes} icon={IconAlertCircle} color="orange" />
          <KPICard title="Presentes hoy" value={kpis.asistencias_hoy} icon={IconClockHour4} color="teal" />
          <KPICard title="Ausentes hoy" value={kpis.ausentes_hoy} icon={IconUserOff} color="red" />
        </SimpleGrid>
      ) : null}

      <Grid>
        {/* Gráfico nóminas por sucursal */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card shadow="sm" p="md" radius="md" withBorder h={320}>
            <Text fw={600} mb="md">Nómina por sucursal (mes actual)</Text>
            {loadingNominas ? (
              <Skeleton h={220} />
            ) : nominasSucursal && nominasSucursal.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={nominasSucursal.map(s => ({
                  name: s.sucursal_nombre ?? 'Sin sucursal',
                  neto: Number(s.total_neto),
                  empleados: s.total_empleados,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: unknown) => formatMoney(Number(v))} />
                  <Bar dataKey="neto" fill="#228be6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert color="gray" variant="light">Sin datos de nómina este mes</Alert>
            )}
          </Card>
        </Grid.Col>

        {/* Eventos pendientes */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card shadow="sm" p="md" radius="md" withBorder h={320}>
            <Text fw={600} mb="md">Últimos eventos pendientes</Text>
            <Stack gap="xs" style={{ overflowY: 'auto', maxHeight: 240 }}>
              {pendientes?.length === 0 && (
                <Text c="dimmed" size="sm">Sin eventos pendientes</Text>
              )}
              {pendientes?.slice(0, 8).map((e) => (
                <Group key={e.id} justify="space-between" wrap="nowrap">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {e.empleado_nombre ?? `Empleado #${e.empleado_id}`}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {e.categoria_nombre ?? `Cat. #${e.categoria_evento_id}`} · {e.fecha_inicial.slice(0, 10)}
                    </Text>
                  </Stack>
                  <Badge color="orange" variant="light" size="xs">Pendiente</Badge>
                </Group>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
