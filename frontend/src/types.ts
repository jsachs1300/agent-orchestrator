export interface GitConfig {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}

export interface GitCredentials {
  authType: 'none' | 'pat';
  patToken?: string;
}

export interface PlanRequestPayload {
  goal: string;
  tools: {
    git: {
      repoOwner: string;
      repoName: string;
      defaultBranch: string;
    };
  };
}

export type PlanResponse = unknown;
