import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminModal, Button, MultiSelect } from '@haderach/shared-ui'
import { Loader2, UserPlus, Trash2 } from 'lucide-react'
import {
  fetchContractorAccess,
  fetchUsers,
  grantContractorAccess,
  revokeContractorAccess,
} from './api'
import type { ContractorAccessGrant, UserSummary } from './api'

interface Props {
  vendorId: string
  vendorName: string
  getIdToken: () => Promise<string>
  onClose: () => void
}

export function ContractorAccessModal({
  vendorId,
  vendorName,
  getIdToken,
  onClose,
}: Props) {
  const [grants, setGrants] = useState<ContractorAccessGrant[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [grantsData, usersData] = await Promise.all([
        fetchContractorAccess(vendorId, getIdToken),
        fetchUsers(getIdToken),
      ])
      setGrants(grantsData)
      setUsers(usersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [vendorId, getIdToken])

  useEffect(() => { loadData() }, [loadData])

  const grantedEmails = useMemo(
    () => new Set(grants.map((g) => g.email)),
    [grants],
  )

  const userItems = useMemo(
    () =>
      users
        .filter((u) => !grantedEmails.has(u.email))
        .sort((a, b) => a.email.localeCompare(b.email))
        .map((u) => ({
          id: u.email,
          label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        })),
    [users, grantedEmails],
  )

  const handleGrant = useCallback(async () => {
    if (selectedEmails.length === 0) return
    setGranting(true)
    setError(null)
    try {
      for (const email of selectedEmails) {
        await grantContractorAccess(vendorId, email, getIdToken)
      }
      setSelectedEmails([])
      const updated = await fetchContractorAccess(vendorId, getIdToken)
      setGrants(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access')
    } finally {
      setGranting(false)
    }
  }, [vendorId, selectedEmails, getIdToken])

  const handleRevoke = useCallback(async (email: string) => {
    setRevoking((prev) => new Set(prev).add(email))
    setError(null)
    try {
      await revokeContractorAccess(vendorId, email, getIdToken)
      setGrants((prev) => prev.filter((g) => g.email !== email))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access')
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev)
        next.delete(email)
        return next
      })
    }
  }, [vendorId, getIdToken])

  return (
    <AdminModal
      title={`Contractor Access — ${vendorName}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      className="min-h-[70vh]"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading access grants…
          </div>
        ) : (
          <>
            <div>
              <span className="text-sm font-medium text-foreground block mb-2">
                Grant access to users
              </span>
              <div className="flex gap-2">
                <div className="flex-1">
                  <MultiSelect
                    items={userItems}
                    selectedIds={selectedEmails}
                    onSelectionChange={setSelectedEmails}
                    searchPlaceholder="Search users…"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleGrant}
                  disabled={granting || selectedEmails.length === 0}
                >
                  {granting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Grant
                </Button>
              </div>
              {selectedEmails.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedEmails.length} user{selectedEmails.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div>
              <span className="text-sm font-medium text-foreground block mb-2">
                Users with access ({grants.length})
              </span>
              {grants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No users have been granted access to this contractor.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {grants.map((grant) => {
                    const isRevoking = revoking.has(grant.email)
                    const name = [grant.firstName, grant.lastName].filter(Boolean).join(' ')
                    return (
                      <div
                        key={grant.email}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {name || grant.email}
                          </p>
                          {name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {grant.email}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Granted {new Date(grant.grantedAt).toLocaleDateString()}
                            {grant.grantedBy && ` by ${grant.grantedBy}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevoke(grant.email)}
                          disabled={isRevoking}
                          className="shrink-0 ml-3 text-muted-foreground hover:text-error disabled:opacity-50"
                          title="Revoke access"
                        >
                          {isRevoking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md bg-error-bg px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
      </div>
    </AdminModal>
  )
}
