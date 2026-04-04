import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AppRail,
  useRailExpanded,
  UserTable,
  TagBadge,
} from '@haderach/shared-ui'
import type { UserTableColumn } from '@haderach/shared-ui'
import { useAuthUser } from './auth/AuthUserContext'
import { UserAccessModal } from './UserAccessModal'
import { ContractorTable } from './ContractorTable'
import { fetchUsers, fetchVendors } from './api'
import type { UserSummary, Vendor } from './api'

type Tab = 'users' | 'contractors'

const VISIBLE_ROLES = ['user', 'admin']

export function App() {
  const authUser = useAuthUser()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<UserSummary[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null)

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vendors) {
      if (v.name) map.set(v.id, v.name)
    }
    return map
  }, [vendors])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [userData, vendorData] = await Promise.all([
        fetchUsers(authUser.getIdToken),
        fetchVendors(authUser.getIdToken),
      ])
      userData.sort((a, b) => a.email.localeCompare(b.email))
      setUsers(userData)
      setVendors(vendorData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [authUser.getIdToken])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUserUpdated = useCallback(() => {
    loadData()
  }, [loadData])

  const columns = useMemo<UserTableColumn<UserSummary>[]>(() => [
    {
      key: 'email',
      header: 'Email',
      render: (u) => <span className="font-medium">{u.email}</span>,
      sortValue: (u) => u.email.toLowerCase(),
      searchValue: (u) => u.email,
    },
    {
      key: 'departments',
      header: 'Departments',
      searchValue: (u) => u.roles.includes('finance_admin') ? 'All' : u.allowedDepartments.join(' '),
      render: (u) => {
        if (u.roles.includes('finance_admin')) {
          return <span className="text-xs font-medium text-green-700">All</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {u.allowedDepartments.length > 0 ? (
              u.allowedDepartments.map((d) => <TagBadge key={d} label={d} variant="muted" />)
            ) : (
              <span className="text-muted-foreground text-xs">None</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'vendors',
      header: 'Vendor Access',
      searchValue: (u) => {
        const names = [
          ...u.allowedVendorIds.map((id) => vendorNameById.get(id) ?? id),
          ...u.deniedVendorIds.map((id) => vendorNameById.get(id) ?? id),
        ]
        return names.join(' ')
      },
      render: (u) => {
        if (u.roles.includes('finance_admin')) {
          return <span className="text-xs font-medium text-green-700">All</span>
        }
        const included = u.allowedVendorIds.length
        const denied = u.deniedVendorIds.length
        if (included === 0 && denied === 0) {
          return <span className="text-muted-foreground text-xs">Dept only</span>
        }
        return (
          <div className="flex gap-2 text-xs">
            {included > 0 && (
              <span className="text-green-700">+{included} included</span>
            )}
            {denied > 0 && (
              <span className="text-error">−{denied} denied</span>
            )}
          </div>
        )
      },
    },
  ], [vendorNameById])

  const [railExpanded, toggleRail] = useRailExpanded()

  return (
    <div className="flex h-screen">
      <AppRail
        apps={authUser.accessibleApps}
        activeAppId="vendor_administration"
        expanded={railExpanded}
        onToggle={toggleRail}
        userEmail={authUser.email}
        userPhotoURL={authUser.photoURL}
        userDisplayName={authUser.displayName}
        onSignOut={authUser.signOut}
        getIdToken={authUser.getIdToken}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Vendor Access Management</h1>
          </div>

          <div className="mb-6 flex gap-1 border-b border-border">
            {([
              { id: 'users' as Tab, label: 'User Access' },
              { id: 'contractors' as Tab, label: 'Contractors' },
            ]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'users' && (
            <>
              {error && (
                <div className="mb-4 rounded-md bg-error-bg px-4 py-3 text-sm text-error">
                  {error}
                </div>
              )}

              <UserTable
                users={users}
                columns={columns}
                loading={loading}
                onRowClick={setSelectedUser}
                filterFn={(u) => u.roles.some((r) => VISIBLE_ROLES.includes(r))}
                className="max-h-[calc(100vh-14rem)]"
              />
            </>
          )}

          {activeTab === 'contractors' && <ContractorTable />}
        </div>
      </main>

      {selectedUser && (
        <UserAccessModal
          userEmail={selectedUser.email}
          userName={[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ')}
          initialDepartments={selectedUser.allowedDepartments}
          initialAllowedVendorIds={selectedUser.allowedVendorIds}
          initialDeniedVendorIds={selectedUser.deniedVendorIds}
          getIdToken={authUser.getIdToken}
          onClose={() => setSelectedUser(null)}
          onUpdated={handleUserUpdated}
        />
      )}
    </div>
  )
}
