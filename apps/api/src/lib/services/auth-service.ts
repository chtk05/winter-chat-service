import type { AuthConfig } from "@/lib/config";
import { isAccessCodeCorrect } from "@/lib/services/access-code";

export interface MemberStore {
  grantMembership(lineUserId: string): Promise<{ alreadyMember: boolean }>;

  isMember(lineUserId: string): Promise<boolean>;
}

export interface JoinDependencies {
  readonly config: Pick<AuthConfig, "accessCode">;
  readonly store: MemberStore;
}

export type JoinOutcome =
  | { readonly outcome: "joined"; readonly alreadyMember: boolean }
  | { readonly outcome: "invalid-request" }
  | { readonly outcome: "rejected" };

export interface JoinInput {
  readonly code: unknown;
  readonly lineUserId: string;
}

export async function joinWorkspace(
  input: JoinInput,
  dependencies: JoinDependencies,
): Promise<JoinOutcome> {
  const submittedCode = normalizeSubmittedCode(input.code);

  if (submittedCode === null) {
    return { outcome: "invalid-request" };
  }

  if (!isAccessCodeCorrect(submittedCode, dependencies.config.accessCode)) {
    return { outcome: "rejected" };
  }

  const { alreadyMember } = await dependencies.store.grantMembership(
    input.lineUserId,
  );

  return { outcome: "joined", alreadyMember };
}

function normalizeSubmittedCode(code: unknown): string | null {
  if (typeof code !== "string") {
    return null;
  }

  const trimmed = code.trim();

  if (trimmed.length === 0 || trimmed.length > 128) {
    return null;
  }

  return trimmed;
}
