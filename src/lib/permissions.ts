/**
 * Granular permissions & product access for AAZ Studio (Phase 4).
 *
 * Permissions control what actions a user can perform.
 * Products control which platform features a user can access.
 *
 * Backward compatible: users without explicit permissions fall back
 * to role-based defaults.
 */

// All available permissions
export const PERMISSIONS = {
  GENERATE_VIDEO: 'generate_video',
  GENERATE_IMAGE: 'generate_image',
  USE_SCENE_DIRECTOR: 'use_scene_director',
  USE_IMAGE_DIRECTOR: 'use_image_director',
  MANAGE_EPISODES: 'manage_episodes',
  MANAGE_ASSETS: 'manage_assets',
  VIEW_ANALYTICS: 'view_analytics',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// All available products
export const PRODUCTS = {
  AAZ_STUDIO: 'aaz_studio',
  COURSES: 'courses',
  COMMUNITY: 'community',
} as const

export type Product = typeof PRODUCTS[keyof typeof PRODUCTS]

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  creator: [
    PERMISSIONS.GENERATE_VIDEO,
    PERMISSIONS.GENERATE_IMAGE,
    PERMISSIONS.USE_SCENE_DIRECTOR,
    PERMISSIONS.USE_IMAGE_DIRECTOR,
    PERMISSIONS.MANAGE_EPISODES,
    PERMISSIONS.MANAGE_ASSETS,
  ],
}

/** Human-readable labels for each permission (PT-BR) */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.GENERATE_VIDEO]: 'Gerar vídeos',
  [PERMISSIONS.GENERATE_IMAGE]: 'Gerar imagens',
  [PERMISSIONS.USE_SCENE_DIRECTOR]: 'Usar Scene Director',
  [PERMISSIONS.USE_IMAGE_DIRECTOR]: 'Usar Image Director',
  [PERMISSIONS.MANAGE_EPISODES]: 'Gerenciar episódios',
  [PERMISSIONS.MANAGE_ASSETS]: 'Gerenciar assets',
  [PERMISSIONS.VIEW_ANALYTICS]: 'Ver analytics',
}

/** Human-readable labels for each product (PT-BR) */
export const PRODUCT_LABELS: Record<Product, string> = {
  [PRODUCTS.AAZ_STUDIO]: 'AAZ Studio',
  [PRODUCTS.COURSES]: 'Cursos',
  [PRODUCTS.COMMUNITY]: 'Comunidade',
}

/**
 * Check if a user has a specific permission.
 * Super admin and admin always have all permissions.
 * If user has explicit permissions array, use those.
 * Otherwise fall back to role defaults.
 */
export function hasPermission(
  userPermissions: string[] | undefined,
  userRole: string,
  permission: Permission
): boolean {
  // Super admin and admin always have all permissions
  if (userRole === 'super_admin' || userRole === 'admin') return true
  // If user has explicit permissions, use those
  if (userPermissions && userPermissions.length > 0) {
    return userPermissions.includes(permission)
  }
  // Fall back to role defaults
  const defaults = DEFAULT_PERMISSIONS[userRole]
  return defaults ? defaults.includes(permission) : false
}

/**
 * Check if user has access to a product.
 * Checks org-level access first, then user-level.
 * If no explicit user products, inherits org access.
 */
export function hasProductAccess(
  userProducts: string[] | undefined,
  orgProducts: string[] | undefined,
  product: Product
): boolean {
  // Check org-level access first
  if (orgProducts && !orgProducts.includes(product)) return false
  // Then user-level (if not set, user inherits org access)
  if (userProducts && userProducts.length > 0) {
    return userProducts.includes(product)
  }
  return true // if no explicit user products, inherits org
}
