import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, AdminModal, MultiSelect, TagBadge } from '@haderach/shared-ui'
import { fetchVendors, updateUserAccess } from './api'
import type { Vendor } from './api'
import { Save, Loader2 } from 'lucide-react'

interface Props {
  userEmail: string
  userName: string
  initialDepartments: string[]
  initialAllowedVendorIds: string[]
  initialDeniedVendorIds: string[]
  getIdToken: () => Promise<string>
  onClose: () => void
  onUpdated: () => void
}

export function UserAccessModal({
  userEmail,
  userName,
  initialDepartments,
  initialAllowedVendorIds,
  initialDeniedVendorIds,
  getIdToken,
  onClose,
  onUpdated,
}: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [vendorError, setVendorError] = useState<string | null>(null)

  const [departments, setDepartments] = useState<string[]>(initialDepartments)
  const [allowedVendorIds, setAllowedVendorIds] = useState<string[]>(initialAllowedVendorIds)
  const [deniedVendorIds, setDeniedVendorIds] = useState<string[]>(initialDeniedVendorIds)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingVendors(true)
    setVendorError(null)
    fetchVendors(getIdToken)
      .then((data) => {
        if (!cancelled) setVendors(data)
      })
      .catch((err) => {
        if (!cancelled) setVendorError(err instanceof Error ? err.message : 'Failed to load vendors')
      })
      .finally(() => {
        if (!cancelled) setLoadingVendors(false)
      })
    return () => { cancelled = true }
  }, [getIdToken])

  const departmentItems = useMemo(() => {
    const deptSet = new Set<string>()
    for (const v of vendors) {
      if (v.department) deptSet.add(v.department)
    }
    return Array.from(deptSet)
      .sort()
      .map((d) => ({ id: d, label: d }))
  }, [vendors])

  const vendorItems = useMemo(() =>
    vendors
      .filter((v) => v.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({
        id: v.id,
        label: v.department ? `${v.name} (${v.department})` : v.name,
      })),
    [vendors],
  )

  const hasChanges = useMemo(() => {
    const arrEq = (a: string[], b: string[]) =>
      a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])
    return (
      !arrEq(departments, initialDepartments) ||
      !arrEq(allowedVendorIds, initialAllowedVendorIds) ||
      !arrEq(deniedVendorIds, initialDeniedVendorIds)
    )
  }, [departments, allowedVendorIds, deniedVendorIds, initialDepartments, initialAllowedVendorIds, initialDeniedVendorIds])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateUserAccess(
        userEmail,
        { allowedDepartments: departments, allowedVendorIds: allowedVendorIds, deniedVendorIds: deniedVendorIds },
        getIdToken,
      )
      onUpdated()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [userEmail, departments, allowedVendorIds, deniedVendorIds, getIdToken, onUpdated, onClose])

  const footerContent = (
    <div className="flex justify-end">
      <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Save className="h-3.5 w-3.5 mr-1" />
        )}
        Save
      </Button>
    </div>
  )

  return (
    <AdminModal
      title="Vendor Access"
      onClose={onClose}
      footer={footerContent}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 pb-48">
        <div className="space-y-1">
          <p className="text-sm text-foreground font-medium">{userName || userEmail}</p>
          {userName && (
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          )}
        </div>

        {loadingVendors ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading vendors…
          </div>
        ) : vendorError ? (
          <div className="rounded-md bg-error-bg px-4 py-3 text-sm text-error">
            {vendorError}
          </div>
        ) : (
          <>
            <Section
              label="Departments"
              description="Grant access to all vendors in selected departments."
            >
              <MultiSelect
                items={departmentItems}
                selectedIds={departments}
                onSelectionChange={setDepartments}
                searchPlaceholder="Search departments…"
              />
              {departments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {departments.map((d) => (
                    <TagBadge key={d} label={d} variant="muted" />
                  ))}
                </div>
              )}
            </Section>

            <Section
              label="Included Vendors"
              description="Grant access to individual vendors beyond department grants."
            >
              <MultiSelect
                items={vendorItems}
                selectedIds={allowedVendorIds}
                onSelectionChange={setAllowedVendorIds}
                searchPlaceholder="Search vendors…"
              />
              {allowedVendorIds.length > 0 && (
                <p className="text-xs text-green-700 mt-1">
                  {allowedVendorIds.length} vendor{allowedVendorIds.length !== 1 ? 's' : ''} included
                </p>
              )}
            </Section>

            <Section
              label="Denied Vendors"
              description="Deny access to specific vendors, overriding department and inclusion grants."
            >
              <MultiSelect
                items={vendorItems}
                selectedIds={deniedVendorIds}
                onSelectionChange={setDeniedVendorIds}
                searchPlaceholder="Search vendors…"
              />
              {deniedVendorIds.length > 0 && (
                <p className="text-xs text-error mt-1">
                  {deniedVendorIds.length} vendor{deniedVendorIds.length !== 1 ? 's' : ''} denied
                </p>
              )}
            </Section>
          </>
        )}

        {saveError && (
          <div className="rounded-md bg-error-bg px-4 py-3 text-sm text-error">
            {saveError}
          </div>
        )}
      </div>
    </AdminModal>
  )
}

function Section({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="text-sm font-medium text-foreground block mb-1">{label}</span>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      {children}
    </div>
  )
}
