import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PagedResult, UpdateUserRolesRequest, UserSummary } from '../models/admin.models';

interface UsersQuery {
  page: number;
  pageSize: number;
  search: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly apiClient = inject(ApiClient);

  async getUsers(query: UsersQuery) {
    const searchParams = new URLSearchParams({
      pageNumber: String(query.page),
      pageSize: String(query.pageSize),
    });

    const normalizedSearch = query.search.trim();
    if (normalizedSearch) {
      searchParams.set('search', normalizedSearch);
    }

    return firstValueFrom(
      this.apiClient.get<PagedResult<UserSummary>>(`/v1/admin/users?${searchParams.toString()}`),
    );
  }

  async getUserById(id: string) {
    return firstValueFrom(this.apiClient.get<UserSummary>(`/v1/admin/users/${id}`));
  }

  async updateUserRoles(id: string, payload: UpdateUserRolesRequest) {
    return firstValueFrom(this.apiClient.put<UserSummary>(`/v1/admin/users/${id}/roles`, payload));
  }

  async setUserLockState(id: string, lock: boolean) {
    return firstValueFrom(this.apiClient.put<UserSummary>(`/v1/admin/users/${id}/lock`, { lock }));
  }
}
