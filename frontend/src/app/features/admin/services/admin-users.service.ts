import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  AdminUserOptions,
  CreateAdminUserRequestDto,
  CreateAdminUserResponseDto,
  PagedResult,
  SetTemporaryPasswordRequestDto,
  SetTemporaryPasswordResponseDto,
  UpdateAdminUserRequestDto,
  UpdateUserRolesRequest,
  UserSummary,
} from '../models/admin.models';

interface UsersQuery {
  page: number;
  pageSize: number;
  search?: string | null;
  role?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
  status?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly apiClient = inject(ApiClient);

  async getUsers(query: UsersQuery) {
    const searchParams = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });

    const normalizedSearch = query.search?.trim() ?? '';
    if (normalizedSearch) {
      searchParams.set('search', normalizedSearch);
    }

    if (query.role) {
      searchParams.set('role', query.role);
    }

    if (query.tenantId) {
      searchParams.set('tenantId', query.tenantId);
    }

    if (query.storeId) {
      searchParams.set('storeId', query.storeId);
    }

    if (query.status) {
      searchParams.set('status', query.status);
    }

    return firstValueFrom(
      this.apiClient.get<PagedResult<UserSummary>>(`/v1/admin/users?${searchParams.toString()}`),
    );
  }

  async getUserOptions() {
    return firstValueFrom(this.apiClient.get<AdminUserOptions>('/v1/admin/users/options'));
  }

  async getUserById(id: string) {
    return firstValueFrom(this.apiClient.get<UserSummary>(`/v1/admin/users/${id}`));
  }

  async updateUserRoles(id: string, payload: UpdateUserRolesRequest) {
    return firstValueFrom(this.apiClient.put<UserSummary>(`/v1/admin/users/${id}/roles`, payload));
  }

  async updateUser(id: string, payload: UpdateAdminUserRequestDto) {
    return firstValueFrom(this.apiClient.put<UserSummary>(`/v1/admin/users/${id}`, payload));
  }

  async setUserLockState(id: string, lock: boolean) {
    return firstValueFrom(this.apiClient.put<UserSummary>(`/v1/admin/users/${id}/lock`, { lock }));
  }

  async createUser(request: CreateAdminUserRequestDto) {
    return firstValueFrom(
      this.apiClient.post<CreateAdminUserResponseDto>('/v1/admin/users', request),
    );
  }

  async setTemporaryPassword(userId: string, request: SetTemporaryPasswordRequestDto) {
    return firstValueFrom(
      this.apiClient.post<SetTemporaryPasswordResponseDto>(
        `/v1/admin/users/${userId}/temporary-password`,
        request,
      ),
    );
  }
}
