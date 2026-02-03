/**
 * Common types and interface for Identity Providers
 */

export interface User {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  firstName?: string;
  lastName?: string;
}

export interface Group {
  id: string;
  name: string;
  path?: string;
}

export interface UserWithGroups extends User {
  groups: string[]; // group names
}

/**
 * Provider interface that all Identity Providers must implement
 */
export interface Provider {
  /**
   * Connect and authenticate to the Identity Provider
   */
  connect(): Promise<void>;

  /**
   * Get all users from the Identity Provider
   */
  getUsers(): Promise<User[]>;

  /**
   * Get all groups from the Identity Provider
   */
  getGroups(): Promise<Group[]>;

  /**
   * Get members of a specific group
   */
  getGroupMembers(groupId: string): Promise<User[]>;

  /**
   * Get all users with their group memberships
   * This is a convenience method that combines getUsers and group membership lookups
   */
  getUsersWithGroups(): Promise<UserWithGroups[]>;
}

export type ProviderType = "keycloak" | "okta" | "azure";

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

export interface OktaConfig {
  domain: string;
  apiToken: string;
}

export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export type ProviderConfig = KeycloakConfig | OktaConfig | AzureConfig;
