import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  AppShell, NavLink, Group, Text, Avatar,
  Menu, Burger, ScrollArea, ActionIcon, Tooltip,
  Divider, Box, useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconDashboard, IconUsers, IconCalendarEvent,
  IconCurrencyDollar, IconChartBar, IconCalendar,
  IconSettings, IconLogout, IconChevronDown,
  IconSun, IconMoon,
} from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import { useColorSchemeStore } from '../stores/colorScheme'

const navItems = [
  { label: 'Dashboard', icon: IconDashboard, to: '/' },
  { label: 'Empleados', icon: IconUsers, to: '/empleados' },
  { label: 'Eventos', icon: IconCalendarEvent, to: '/eventos' },
  { label: 'Nóminas', icon: IconCurrencyDollar, to: '/nominas' },
  { label: 'Reportes', icon: IconChartBar, to: '/reportes' },
  { label: 'Calendario', icon: IconCalendar, to: '/calendario' },
  { label: 'Configuración', icon: IconSettings, to: '/config' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [opened, { toggle, close }] = useDisclosure()
  const colorScheme = useColorSchemeStore((s) => s.colorScheme)
  const toggleTheme = useColorSchemeStore((s) => s.toggle)
  const { setColorScheme } = useMantineColorScheme()

  const handleToggleTheme = () => {
    const next = colorScheme === 'light' ? 'dark' : 'light'
    toggleTheme()
    setColorScheme(next)
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
      styles={{
        header: {
          borderBottom: '1px solid var(--mantine-color-default-border)',
          backdropFilter: 'blur(10px)',
        },
        navbar: {
          borderRight: '1px solid var(--mantine-color-default-border)',
        },
        main: {
          backgroundColor: 'var(--mantine-color-body)',
          minHeight: '100vh',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap={8}>
              <Box
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-5))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text fw={800} size="sm" c="white">N</Text>
              </Box>
              <Box>
                <Text fw={700} size="md" lh={1.1}>Nómina</Text>
                <Text size="xs" c="dimmed" lh={1}>Calzalindo</Text>
              </Box>
            </Group>
          </Group>
          <Group gap="sm">
            <Tooltip label={colorScheme === 'light' ? 'Modo oscuro' : 'Modo claro'}>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={handleToggleTheme}
                radius="md"
              >
                {colorScheme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Group gap="xs" style={{ cursor: 'pointer' }} px={4} py={2}>
                  <Avatar radius="xl" size="sm" color="indigo" variant="filled">
                    {user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box visibleFrom="sm">
                    <Text size="sm" fw={500} lh={1.2}>{user?.username}</Text>
                    <Text size="xs" c="dimmed" lh={1}>{user?.rol}</Text>
                  </Box>
                  <IconChevronDown size={14} />
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Sesión</Menu.Label>
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  color="red"
                  onClick={logout}
                >
                  Cerrar sesión
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <Box mb="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" px="sm" mb={4}>
              Menú principal
            </Text>
          </Box>
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                leftSection={<item.icon size={18} stroke={1.5} />}
                active={isActive}
                onClick={close}
                mb={2}
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
                styles={{
                  root: {
                    fontWeight: isActive ? 600 : 400,
                  },
                }}
              />
            )
          })}
        </AppShell.Section>
        <AppShell.Section>
          <Divider my="sm" />
          <Group px="sm" pb="xs" gap={6}>
            <Avatar radius="xl" size="sm" color="indigo" variant="light">
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Text size="xs" fw={500}>{user?.username}</Text>
              <Text size="xs" c="dimmed">{user?.rol}</Text>
            </Box>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
