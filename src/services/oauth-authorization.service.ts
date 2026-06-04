import { BaseApiService } from "./base-api.service";

export type OAuthAuthorizationParameters = Record<string, string | string[]>;

export interface OAuthScopeGrant {
  value: string;
  description: string;
}

export interface OAuthAuthorizationRequest {
  client_id: string;
  client_name: string;
  client_uri: string;
  logo_uri: string;
  redirect_uri: string;
  scopes: OAuthScopeGrant[];
}

export interface OAuthAuthorizationRedirect {
  redirect_url: string;
}

export interface OAuthAuthorizationError {
  error: string;
}

export type OAuthAuthorizationDetails =
  | OAuthAuthorizationRequest
  | OAuthAuthorizationRedirect
  | OAuthAuthorizationError;

export class OAuthAuthorizationService extends BaseApiService {
  async getAuthorizationDetails(
    authorizationParameters: OAuthAuthorizationParameters,
  ): Promise<OAuthAuthorizationDetails> {
    const response = await this.get<OAuthAuthorizationDetails>(
      "oauth/authorize/request/",
      authorizationParameters,
    );
    return response.data;
  }

  async completeAuthorization({
    authorizationParameters,
    scopes,
    allow,
  }: {
    authorizationParameters: OAuthAuthorizationParameters;
    scopes: string[];
    allow: boolean;
  }): Promise<OAuthAuthorizationRedirect> {
    const response = await this.post<OAuthAuthorizationRedirect>(
      "oauth/authorize/request/",
      {
        authorization_params: authorizationParameters,
        scopes,
        allow,
      },
    );
    return response.data;
  }
}
