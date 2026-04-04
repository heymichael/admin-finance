import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardContent,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  TagBadge,
} from '@haderach/shared-ui'
import { Search, X, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react'
import { useAuthUser } from './auth/AuthUserContext'
import { fetchVendors, setIsContractor } from './api'
import type { Vendor } from './api'
import { ContractorAccessModal } from './ContractorAccessModal'

type SortDir = 'asc' | 'desc'

export function ContractorTable() {
  const authUser = useAuthUser()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)

  const loadVendors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchVendors(authUser.getIdToken)
      data.sort((a, b) => a.name.localeCompare(b.name))
      setVendors(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [authUser.getIdToken])

  useEffect(() => { loadVendors() }, [loadVendors])

  const handleToggle = useCallback(async (vendor: Vendor) => {
    const newVal = !vendor.isContractor
    setToggling((prev) => new Set(prev).add(vendor.id))
    try {
      await setIsContractor(vendor.id, newVal, authUser.getIdToken)
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, isContractor: newVal } : v)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contractor status')
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(vendor.id)
        return next
      })
    }
  }, [authUser.getIdToken])

  const filtered = useMemo(() => {
    if (!search) return vendors
    const lower = search.toLowerCase()
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        (v.department ?? '').toLowerCase().includes(lower),
    )
  }, [vendors, search])

  const displayed = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (sortKey === 'name') {
        va = a.name.toLowerCase()
        vb = b.name.toLowerCase()
      } else if (sortKey === 'department') {
        va = (a.department ?? '').toLowerCase()
        vb = (b.department ?? '').toLowerCase()
      } else if (sortKey === 'contractor') {
        va = a.isContractor ? 1 : 0
        vb = b.isContractor ? 1 : 0
      } else {
        return 0
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const contractorCount = vendors.filter((v) => v.isContractor).length

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contractorCount} contractor{contractorCount !== 1 ? 's' : ''} of {vendors.length} vendors
        </p>
      </div>

      <Card className="flex flex-col min-h-0 max-h-[calc(100vh-14rem)]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <>
              <span className="text-xs text-muted-foreground shrink-0">
                {filtered.length} of {vendors.length}
              </span>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="sticky top-0 z-10 bg-background cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('name')}
                >
                  <span className="inline-flex items-center gap-1">
                    Name <SortIcon colKey="name" />
                  </span>
                </TableHead>
                <TableHead
                  className="sticky top-0 z-10 bg-background cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('department')}
                >
                  <span className="inline-flex items-center gap-1">
                    Department <SortIcon colKey="department" />
                  </span>
                </TableHead>
                <TableHead
                  className="sticky top-0 z-10 bg-background cursor-pointer select-none hover:text-foreground w-32"
                  onClick={() => handleSort('contractor')}
                >
                  <span className="inline-flex items-center gap-1">
                    Contractor <SortIcon colKey="contractor" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading vendors…
                  </TableCell>
                </TableRow>
              ) : displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    {search ? 'No matching vendors' : 'No vendors found'}
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map((vendor) => {
                  const isContractor = !!vendor.isContractor
                  const isToggling = toggling.has(vendor.id)
                  return (
                    <TableRow
                      key={vendor.id}
                      className={isContractor ? 'cursor-pointer hover:bg-accent/50' : undefined}
                      onClick={isContractor ? () => setSelectedVendor(vendor) : undefined}
                    >
                      <TableCell>
                        <span className={`font-medium ${isContractor ? 'text-primary underline underline-offset-2 cursor-pointer' : ''}`}>
                          {vendor.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        {vendor.department ? (
                          <TagBadge label={vendor.department} variant="muted" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isContractor}
                          disabled={isToggling}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggle(vendor)
                          }}
                          className={`
                            relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
                            transition-colors duration-200 ease-in-out
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${isContractor ? 'bg-primary' : 'bg-muted-foreground/30'}
                          `}
                        >
                          <span
                            className={`
                              pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm
                              transition-transform duration-200 ease-in-out
                              ${isContractor ? 'translate-x-4' : 'translate-x-0.5'}
                            `}
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedVendor && (
        <ContractorAccessModal
          vendorId={selectedVendor.id}
          vendorName={selectedVendor.name}
          getIdToken={authUser.getIdToken}
          onClose={() => setSelectedVendor(null)}
        />
      )}
    </>
  )
}
