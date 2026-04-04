import { agentFetch } from '@haderach/shared-ui'

export interface UserSummary {
  email: string
  firstName: string
  lastName: string
  roles: string[]
  allowedDepartments: string[]
  allowedVendorIds: string[]
  deniedVendorIds: string[]
}

export interface Vendor {
  id: string
  name: string
  department?: string
  isContractor?: boolean
}

export interface ContractorAccessGrant {
  userId: string
  email: string
  firstName: string
  lastName: string
  grantedBy: string
  grantedAt: string
}

export async function fetchUsers(
  getIdToken: () => Promise<string>,
): Promise<UserSummary[]> {
  const res = await agentFetch('/users', getIdToken)
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)
  return res.json()
}

export async function fetchVendors(
  getIdToken: () => Promise<string>,
): Promise<Vendor[]> {
  const res = await agentFetch('/vendors', getIdToken)
  if (!res.ok) throw new Error(`Failed to fetch vendors: ${res.status}`)
  return res.json()
}

export async function updateUserAccess(
  email: string,
  fields: {
    allowedDepartments: string[]
    allowedVendorIds: string[]
    deniedVendorIds: string[]
  },
  getIdToken: () => Promise<string>,
): Promise<UserSummary> {
  const res = await agentFetch(`/users/${encodeURIComponent(email)}`, getIdToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Update failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchContractorVendors(
  getIdToken: () => Promise<string>,
): Promise<Vendor[]> {
  const res = await agentFetch('/vendors/contractors', getIdToken)
  if (!res.ok) throw new Error(`Failed to fetch contractor vendors: ${res.status}`)
  return res.json()
}

export async function setIsContractor(
  vendorId: string,
  isContractor: boolean,
  getIdToken: () => Promise<string>,
): Promise<void> {
  const res = await agentFetch(`/vendors/${vendorId}/contractor`, getIdToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_contractor: isContractor }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Failed to update contractor status: ${res.status}`)
  }
}

export async function fetchContractorAccess(
  vendorId: string,
  getIdToken: () => Promise<string>,
): Promise<ContractorAccessGrant[]> {
  const res = await agentFetch(`/vendors/${vendorId}/access`, getIdToken)
  if (!res.ok) throw new Error(`Failed to fetch access grants: ${res.status}`)
  return res.json()
}

export async function grantContractorAccess(
  vendorId: string,
  userEmail: string,
  getIdToken: () => Promise<string>,
): Promise<void> {
  const res = await agentFetch(`/vendors/${vendorId}/access`, getIdToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Failed to grant access: ${res.status}`)
  }
}

export async function revokeContractorAccess(
  vendorId: string,
  userEmail: string,
  getIdToken: () => Promise<string>,
): Promise<void> {
  const res = await agentFetch(`/vendors/${vendorId}/access/${encodeURIComponent(userEmail)}`, getIdToken, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Failed to revoke access: ${res.status}`)
  }
}
