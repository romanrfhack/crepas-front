export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isLocked: boolean;
  roles: string[];
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface RoleDto {
  id: string;
  name: string;
}

export interface UpdateUserRolesRequest {
  roles: string[];
}
