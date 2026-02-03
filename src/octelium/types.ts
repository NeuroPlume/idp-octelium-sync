/**
 * Octelium resource types
 */

export interface OcteliumUser {
  kind: "User";
  metadata: {
    name: string;
  };
  spec: {
    type: "HUMAN" | "WORKLOAD";
    email?: string;
    groups?: string[];
    attrs?: Record<string, unknown>;
  };
}

export interface OcteliumGroup {
  kind: "Group";
  metadata: {
    name: string;
    displayName?: string;
  };
  spec: {
    authorization?: {
      policies?: string[];
    };
    attrs?: Record<string, unknown>;
  };
}

export type OcteliumResource = OcteliumUser | OcteliumGroup;
