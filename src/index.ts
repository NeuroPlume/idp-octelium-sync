#!/usr/bin/env bun
import { Command } from "commander";
import { KeycloakProvider } from "./providers";
import { MappingLoader, shouldExcludeUser } from "./mapping/loader";
import { generateUsersYaml, generateGroupsYaml } from "./octelium";

const program = new Command();

program
  .name("idp-octelium-sync")
  .description(
    "Sync users and groups from Identity Providers to Octelium manifests"
  )
  .version("1.0.0");

program
  .command("sync")
  .description("Sync users and groups from IdP to Octelium YAML manifests")
  .requiredOption("--provider <type>", "Identity provider type (keycloak)")
  .requiredOption("--mapping <path>", "Path to group-mapping.yaml file")
  .requiredOption("--output-users <path>", "Output path for users.yaml")
  .requiredOption("--output-groups <path>", "Output path for groups.yaml")
  // Keycloak options
  .option("--keycloak-url <url>", "Keycloak server URL", process.env.KEYCLOAK_URL)
  .option("--keycloak-realm <realm>", "Keycloak realm name", process.env.KEYCLOAK_REALM)
  .option("--keycloak-client-id <id>", "Keycloak client ID", process.env.KEYCLOAK_CLIENT_ID)
  .option("--keycloak-client-secret <secret>", "Keycloak client secret", process.env.KEYCLOAK_CLIENT_SECRET)
  // Filters
  .option("--exclude-users <patterns>", "Comma-separated patterns to exclude users", "")
  // Other options
  .option("--dry-run", "Print output instead of writing files", false)
  .action(async (options) => {
    try {
      await runSync(options);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

interface SyncOptions {
  provider: string;
  mapping: string;
  outputUsers: string;
  outputGroups: string;
  keycloakUrl?: string;
  keycloakRealm?: string;
  keycloakClientId?: string;
  keycloakClientSecret?: string;
  excludeUsers: string;
  dryRun: boolean;
}

async function runSync(options: SyncOptions): Promise<void> {
  console.log("Starting sync...\n");

  // Validate provider
  if (options.provider !== "keycloak") {
    throw new Error(
      `Unsupported provider: ${options.provider}. Supported: keycloak`
    );
  }

  // Validate Keycloak options
  if (options.provider === "keycloak") {
    if (!options.keycloakUrl) throw new Error("--keycloak-url is required");
    if (!options.keycloakRealm) throw new Error("--keycloak-realm is required");
    if (!options.keycloakClientId) throw new Error("--keycloak-client-id is required");
    if (!options.keycloakClientSecret) throw new Error("--keycloak-client-secret is required (or set KEYCLOAK_CLIENT_SECRET env)");
  }

  // Load mapping
  console.log(`Loading mapping from: ${options.mapping}`);
  const mappingLoader = await MappingLoader.fromFile(options.mapping);
  console.log(`✓ Loaded mapping with ${mappingLoader.getDefinedGroups().length} groups defined\n`);

  // Create provider
  const provider = new KeycloakProvider({
    url: options.keycloakUrl!,
    realm: options.keycloakRealm!,
    clientId: options.keycloakClientId!,
    clientSecret: options.keycloakClientSecret!,
  });

  // Connect to provider
  await provider.connect();

  // Get data from provider
  console.log("\nFetching groups...");
  const groups = await provider.getGroups();
  console.log(`✓ Found ${groups.length} groups`);

  console.log("Fetching users with group memberships...");
  const usersWithGroups = await provider.getUsersWithGroups();
  console.log(`✓ Found ${usersWithGroups.length} users\n`);

  // Apply exclude patterns
  const excludePatterns = options.excludeUsers
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const filteredUsers = usersWithGroups.filter((user) => {
    if (!user.enabled) {
      console.log(`  Skipping disabled user: ${user.username}`);
      return false;
    }
    if (shouldExcludeUser(user.username, excludePatterns)) {
      console.log(`  Skipping excluded user: ${user.username}`);
      return false;
    }
    return true;
  });

  console.log(`\n✓ ${filteredUsers.length} users after filtering`);

  // Generate manifests
  const generatorOptions = { providerName: options.provider };

  console.log("\nGenerating groups manifest...");
  const { yaml: groupsYaml, resolvedGroups } = generateGroupsYaml(
    groups,
    mappingLoader,
    generatorOptions
  );
  console.log(`✓ Generated ${resolvedGroups.size} groups`);

  console.log("Generating users manifest...");
  const usersYaml = generateUsersYaml(
    filteredUsers,
    resolvedGroups,
    generatorOptions
  );
  console.log(`✓ Generated ${filteredUsers.length} users`);

  // Write or print output
  if (options.dryRun) {
    console.log("\n--- DRY RUN: groups.yaml ---");
    console.log(groupsYaml);
    console.log("\n--- DRY RUN: users.yaml ---");
    console.log(usersYaml);
  } else {
    console.log(`\nWriting ${options.outputGroups}...`);
    await Bun.write(options.outputGroups, groupsYaml);
    console.log(`Writing ${options.outputUsers}...`);
    await Bun.write(options.outputUsers, usersYaml);
    console.log("\n✓ Sync completed successfully!");
  }
}

program.parse();
