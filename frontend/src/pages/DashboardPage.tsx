import { useQuery } from '@tanstack/react-query'
import {
  Grid, Card, Text, Title, Group, Stack, Badge,
  SimpleGrid, Skeleton, Alert, ThemeIcon, Box,
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
    <Card p="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={6}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>{title}</Text>
          <Text size="xl" fw={700} lh={1}>{value}</Text>
        </Stack>
        <ThemeIcon variant="light" color={color} size="xl" radius="md">
          <Icon size={22} />
        </ThemeIcon>
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
      <Box>
        <Title order={2}>Dashboard</Title>
        <Text size="sm" c="dimmed">Resumen general del sistema</Text>
      </Box>

      {/* KPIs */}
      {loadingKpis ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={90} radius="md" />)}
        </SimpleGrid>
      ) : kpis ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
          <KPICard title="Empleados activos" value={kpis.total_empleados_activos} icon={IconUsers} color="indigo" />
          <KPICard title="Total en nóminas" value={formatMoney(kpis.total_nomina_mes_actual)} icon={IconCurrencyDollar} color="green" />
          <KPICard title="Eventos pendientes" value={kpis.eventos_pendientes} icon={IconAlertCircle} color="orange" />
          <KPICard title="Presentes hoy" value={kpis.asistencias_hoy} icon={IconClockHour4} color="teal" />
          <KPICard title="Ausentes hoy" value={kpis.ausentes_hoy} icon={IconUserOff} color="red" />
        </SimpleGrid>
      ) : null}

      <Grid>
        {/* Gráfico nóminas por sucursal */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card p="lg" h={340}>
            <Text fw={600} mb="md" size="sm">Nómina por sucursal (mes actual)</Text>
            {loadingNominas ? (
              <Skeleton h={240} />
            ) : nominasSucursal && nominasSucursal.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={nominasSucursal.map(s => ({
                  name: s.sucursal_nombre ?? 'Sin sucursal',
                  neto: Number(s.total_neto),
                  empleados: s.total_empleados,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--mantine-color-dimmed)' }} />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
                  />
                  <Tooltip
                    formatter={(v: unknown) => formatMoney(Number(v))}
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-body)',
                      border: '1px solid var(--mantine-color-default-border)',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="neto" fill="var(--mantine-color-indigo-6)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert color="gray" variant="light">Sin datos de nómina este mes</Alert>
            )}
          </Card>
        </Grid.Col>

        {/* Eventos pendientes */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card p="lg" h={340}>
            <Text fw={600} mb="md" size="sm">Eventos pendientes</Text>
            <Stack gap="xs" style={{ overflowY: 'auto', maxHeight: 260 }}>
              {pendientes?.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" py="xl">Sin eventos pendientes</Text>
              )}
              {pendientes?.slice(0, 8).map((e) => (
                <Card key={e.id} p="xs" radius="md" withBorder={false}
                  style={{ backgroundColor: 'var(--mantine-color-default-hover)' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>
                        {e.empleado_nombre ?? `Empleado #${e.empleado_id}`}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {e.categoria_nombre ?? `Cat. #${e.categoria_evento_id}`} · {e.fecha_inicial.slice(0, 10)}
                      </Text>
                    </Stack>
                    <Badge color="orange" variant="light" size="sm">Pendiente</Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
