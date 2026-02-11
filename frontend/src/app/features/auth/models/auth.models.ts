export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthRegisterRequest {
  email: string;
  password: string;
}

export interface AuthRefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokensResponse {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
}
