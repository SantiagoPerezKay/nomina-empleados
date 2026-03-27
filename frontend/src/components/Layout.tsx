import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  AppShell, NavLink, Group, Text, Avatar,
  Menu, Burger, ScrollArea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconDashboard, IconUsers, IconCalendarEvent,
  IconCurrencyDollar, IconClockHour4, IconChartBar,
  IconSettings, IconLogout, IconChevronDown,
} from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { label: 'Dashboard', icon: IconDashboard, to: '/' },
  { label: 'Empleados', icon: IconUsers, to: '/empleados' },
  { label: 'Eventos', icon: IconCalendarEvent, to: '/eventos' },
  { label: 'Nóminas', icon: IconCurrencyDollar, to: '/nominas' },
  { label: 'Asistencias', icon: IconClockHour4, to: '/asistencias' },
  { label: 'Reportes', icon: IconChartBar, to: '/reportes' },
  { label: 'Configuración', icon: IconSettings, to: '/config' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">Nómina</Text>
          </Group>
          <Menu shadow="md" width={180}>
            <Menu.Target>
              <Group gap="xs" style={{ cursor: 'pointer' }}>
                <Avatar radius="xl" size="sm" color="blue">
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Text size="sm" visibleFrom="sm">{user?.username}</Text>
                <IconChevronDown size={14} />
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.rol}</Menu.Label>
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
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              leftSection={<item.icon size={16} />}
              active={
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
              }
              mb={2}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
