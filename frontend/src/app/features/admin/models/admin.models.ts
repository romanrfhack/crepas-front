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
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface RoleDto {
  name: string;
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
