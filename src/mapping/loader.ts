import { parse as parseYaml } from "yaml";
import { minimatch } from "minimatch";

/**
 * Group mapping configuration
 */
export interface GroupMappingEntry {
  /** Target group name in Octelium (defaults to key name) */
  octeliumGroup?: string;
  /** Display name for the group */
  displayName?: string;
  /** Policies to assign to this group */
  policies?: string[];
  /** Whether to sync this group (default: true) */
  sync?: boolean;
}

export interface MappingDefaults {
  /** What to do with groups not in the mapping: 'skip' | 'include' | 'include-no-policies' */
  unmappedGroups?: "skip" | "include" | "include-no-policies";
  /** Default policies for groups without explicit policies */
  defaultPolicies?: string[];
}

export interface GroupMapping {
  groups: Record<string, GroupMappingEntry>;
  defaults?: MappingDefaults;
}

/**
 * Resolved group mapping with all defaults applied
 */
export interface ResolvedGroupMapping {
  octeliumGroup: string;
  displayName: string;
  policies: string[];
  sync: boolean;
}

export class MappingLoader {
  private mapping: GroupMapping;
  private defaults: Required<MappingDefaults>;

  constructor(mapping: GroupMapping) {
    this.mapping = mapping;
    this.defaults = {
      unmappedGroups: mapping.defaults?.unmappedGroups ?? "skip",
      defaultPolicies: mapping.defaults?.defaultPolicies ?? [],
    };
  }

  /**
   * Load mapping from a YAML file
   */
  static async fromFile(filePath: string): Promise<MappingLoader> {
    const content = await Bun.file(filePath).text();
    const mapping = parseYaml(content) as GroupMapping;

    if (!mapping.groups) {
      throw new Error(`Invalid mapping file: missing 'groups' key`);
    }

    return new MappingLoader(mapping);
  }

  /**
   * Resolve a group from the IdP to Octelium mapping
   * Returns null if the group should be skipped
   */
  resolveGroup(idpGroupName: string): ResolvedGroupMapping | null {
    const entry = this.mapping.groups[idpGroupName];

    // Group is explicitly in the mapping
    if (entry) {
      // Check if explicitly disabled
      if (entry.sync === false) {
        return null;
      }

      return {
        octeliumGroup: entry.octeliumGroup ?? idpGroupName,
        displayName: entry.displayName ?? idpGroupName,
        policies: entry.policies ?? this.defaults.defaultPolicies,
        sync: entry.sync ?? true,
      };
    }

    // Group not in mapping - apply default behavior
    switch (this.defaults.unmappedGroups) {
      case "skip":
        return null;
      case "include":
        return {
          octeliumGroup: idpGroupName,
          displayName: idpGroupName,
          policies: this.defaults.defaultPolicies,
          sync: true,
        };
      case "include-no-policies":
        return {
          octeliumGroup: idpGroupName,
          displayName: idpGroupName,
          policies: [],
          sync: true,
        };
      default:
        return null;
    }
  }

  /**
   * Get all explicitly defined groups from the mapping
   */
  getDefinedGroups(): string[] {
    return Object.keys(this.mapping.groups);
  }
}

/**
 * Filter users based on exclude patterns
 */
export function shouldExcludeUser(
  username: string,
  excludePatterns: string[]
): boolean {
  for (const pattern of excludePatterns) {
    if (minimatch(username, pattern)) {
      return true;
    }
  }
  return false;
}
