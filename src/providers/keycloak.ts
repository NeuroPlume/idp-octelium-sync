import KcAdminClient from "@keycloak/keycloak-admin-client";
import type {
  Provider,
  User,
  Group,
  UserWithGroups,
  KeycloakConfig,
} from "./provider";

export class KeycloakProvider implements Provider {
  private client: KcAdminClient;
  private config: KeycloakConfig;
  private connected = false;

  constructor(config: KeycloakConfig) {
    this.config = config;
    this.client = new KcAdminClient({
      baseUrl: config.url,
      realmName: config.realm,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.auth({
        grantType: "client_credentials",
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      });
      this.connected = true;
      console.log(
        `✓ Connected to Keycloak at ${this.config.url}, realm: ${this.config.realm}`
      );
    } catch (error) {
      throw new Error(
        `Failed to connect to Keycloak: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Not connected to Keycloak. Call connect() first.");
    }
  }

  async getUsers(): Promise<User[]> {
    this.ensureConnected();

    const users = await this.client.users.find({
      max: 10000, // Adjust based on your needs
    });

    return users.map((u) => ({
      id: u.id!,
      username: u.username!,
      email: u.email || "",
      enabled: u.enabled ?? true,
      firstName: u.firstName,
      lastName: u.lastName,
    }));
  }

  async getGroups(): Promise<Group[]> {
    this.ensureConnected();

    const groups = await this.client.groups.find({
      max: 10000,
    });

    // Flatten nested groups
    return this.flattenGroups(groups);
  }

  private flattenGroups(groups: any[], result: Group[] = []): Group[] {
    for (const g of groups) {
      result.push({
        id: g.id!,
        name: g.name!,
        path: g.path,
      });
      if (g.subGroups?.length) {
        this.flattenGroups(g.subGroups, result);
      }
    }
    return result;
  }

  async getGroupMembers(groupId: string): Promise<User[]> {
    this.ensureConnected();

    const members = await this.client.groups.listMembers({
      id: groupId,
      max: 10000,
    });

    return members.map((u) => ({
      id: u.id!,
      username: u.username!,
      email: u.email || "",
      enabled: u.enabled ?? true,
      firstName: u.firstName,
      lastName: u.lastName,
    }));
  }

  async getUsersWithGroups(): Promise<UserWithGroups[]> {
    this.ensureConnected();

    // Get all users and groups first
    const users = await this.getUsers();
    const groups = await this.getGroups();

    // Build a map of userId -> groupNames by fetching members of each group
    // This is more efficient than fetching groups for each user (N+1 problem)
    const userGroupsMap = new Map<string, string[]>();

    // Initialize all users with empty groups
    for (const user of users) {
      userGroupsMap.set(user.id, []);
    }

    // Fetch members for each group and build reverse mapping
    console.log(`  Fetching members for ${groups.length} groups...`);
    for (const group of groups) {
      try {
        const members = await this.client.groups.listMembers({
          id: group.id,
          max: 10000,
        });

        for (const member of members) {
          const userGroups = userGroupsMap.get(member.id!);
          if (userGroups) {
            userGroups.push(group.name);
          }
        }
      } catch (error) {
        console.warn(
          `Warning: Could not get members for group ${group.name}: ${error}`
        );
      }
    }

    // Combine users with their groups
    return users.map((user) => ({
      ...user,
      groups: userGroupsMap.get(user.id) || [],
    }));
  }
}
