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
