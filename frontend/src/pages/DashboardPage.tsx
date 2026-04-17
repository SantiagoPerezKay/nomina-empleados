import { useQuery } from '@tanstack/react-query'
import {
  Grid, Card, Text, Title, Group, Stack, Badge,
  SimpleGrid, Skeleton, Alert, ThemeIcon, Box, useMantineColorScheme,
} from '@mantine/core'
import {
  IconUsers, IconCurrencyDollar, IconAlertCircle,
  IconClockHour4, IconUserOff,
} from '@tabler/icons-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { getKPIs, getNominasPorSucursal } from '../api/dashboard'
import { getEventosPendientes } from '../api/eventos'

function KPICard({ title, value, icon: Icon, color }: {
  title: string; value: string | number; icon: React.ElementType; color: string
}) {
  return (
    <Card p="lg" withBorder radius="md">
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

const BAR_COLORS = [
  '#4c6ef5', '#7950f2', '#ae3ec9', '#e64980',
  '#f76707', '#2f9e44', '#1098ad', '#0c8599',
]

function CustomTooltip({ active, payload, label, formatter }: TooltipProps<number, string> & { formatter: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(20,21,23,0.92)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
      minWidth: 140,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {formatter(Number(p.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

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

  const axisColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'

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
          <Card p="lg" h={340} withBorder radius="md">
            <Text fw={600} mb="md" size="sm">Nómina por sucursal (mes actual)</Text>
            {loadingNominas ? (
              <Skeleton h={240} />
            ) : nominasSucursal && nominasSucursal.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={nominasSucursal.map(s => ({
                    name: s.sucursal_nombre ?? 'Sin sucursal',
                    neto: Number(s.total_neto),
                    empleados: s.total_empleados,
                  }))}
                  barCategoryGap="30%"
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    {BAR_COLORS.map((color, i) => (
                      <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke={gridColor}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: axisColor, fontWeight: 500 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={<CustomTooltip formatter={formatMoney} />}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', radius: 6 }}
                  />
                  <Bar dataKey="neto" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    {nominasSucursal.map((_, i) => (
                      <Cell key={i} fill={`url(#grad${i % BAR_COLORS.length})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert color="gray" variant="light">Sin datos de nómina este mes</Alert>
            )}
          </Card>
        </Grid.Col>

        {/* Eventos pendientes */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card p="lg" h={340} withBorder radius="md">
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
