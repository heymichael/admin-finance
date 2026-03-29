export {
  APP_CATALOG,
  APP_GRANTING_ROLES,
  ADMIN_CATALOG,
  ADMIN_GRANTING_ROLES,
  hasAppAccess,
  getAccessibleApps,
  getAccessibleAdminApps,
  fetchUserDoc,
  buildDisplayName,
} from '@haderach/shared-ui'
export type { NavApp as AccessibleApp, UserDoc } from '@haderach/shared-ui'

export const APP_ID = 'finance_administration'
