export interface UserSummary {
  id: string;
  email: string;
  userName?: string;
  fullName?: string;
  isLockedOut?: boolean;
  isLocked?: boolean;
  roles: string[];
  tenantId?: string | null;
  storeId?: string | null;
  displayName?: string;
  primaryRole?: RoleOption;
  roleDetails?: RoleOption[];
  tenant?: TenantOption | null;
  store?: StoreOption | null;
  status?: UserStatus;
  allowedActions?: AllowedActions;
}

export interface PagedResult<T> {
  items: T[];
  total?: number;
  totalCount?: number;
  pageNumber: number;
  pageSize: number;
}

export interface RoleDto {
  name: string;
}

export interface RoleOption {
  name: string;
  displayName: string;
  description?: string | null;
  level: number;
}

export interface TenantOption {
  id: string;
  name: string;
  slug?: string | null;
}

export interface StoreOption {
  id: string;
  tenantId: string;
  name: string;
}

export interface UserStatus {
  isLockedOut: boolean;
  lockoutEnd?: string | null;
  label: string;
}

export interface AllowedActions {
  canEdit: boolean;
  canChangeRole: boolean;
  canChangeScope: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canResetTemporaryPassword: boolean;
}

export interface AdminUserCurrentScope {
  role: string;
  roleDisplayName?: string;
  roleDescription?: string | null;
  roleLevel?: number;
  tenantId?: string | null;
  tenantName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
}

export interface AdminUserOptions {
  roles: RoleOption[];
  tenants: TenantOption[];
  stores: StoreOption[];
  currentScope: AdminUserCurrentScope;
}

export interface UpdateUserRolesRequest {
  roles: string[];
}

export interface CreateAdminUserRequestDto {
  email: string;
  userName: string;
  role: string;
  tenantId: string | null;
  storeId: string | null;
  temporaryPassword: string;
}

export interface CreateAdminUserResponseDto {
  id: string;
  email: string;
  userName: string;
  roles: string[];
  tenantId: string | null;
  storeId: string | null;
  isLockedOut: boolean;
}

export interface SetTemporaryPasswordRequestDto {
  temporaryPassword: string;
}

export interface SetTemporaryPasswordResponseDto {
  id: string;
  email: string;
  userName: string;
  roles: string[];
  tenantId: string | null;
  storeId: string | null;
  message: string;
}

export interface UpdateAdminUserRequestDto {
  userName: string;
  tenantId: string | null;
  storeId: string | null;
}
