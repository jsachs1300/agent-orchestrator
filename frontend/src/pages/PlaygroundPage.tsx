import { useMemo, useState } from 'react';
import GitConfigFields from '../components/GitConfigFields';
import PromptForm from '../components/PromptForm';
import ResultPanel from '../components/ResultPanel';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GitConfig, GitCredentials, PlanRequestPayload, PlanResponse } from '../types';

const defaultGitConfig: GitConfig = {
  repoOwner: '',
  repoName: '',
  defaultBranch: 'main',
};

const defaultGitCredentials: GitCredentials = {
  authType: 'none',
  patToken: '',
};

export default function PlaygroundPage() {
  const [gitConfig] = useLocalStorage<GitConfig>('gitConfig', defaultGitConfig);
  const [gitCredentials] = useLocalStorage<GitCredentials>('gitCredentials', defaultGitCredentials);
  const [response, setResponse] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<{ status?: number; statusText?: string; body?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || '', []);

  const handleRun = async ({ prompt }: { prompt: string }) => {
    setIsLoading(true);
    setError(null);

    const payload: PlanRequestPayload = {
      goal: prompt,
      tools: {
        git: {
          repoOwner: gitConfig.repoOwner,
          repoName: gitConfig.repoName,
          defaultBranch: gitConfig.defaultBranch || 'main',
        },
      },
    };

    try {
      const response = await fetch(`${apiBaseUrl}/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(gitCredentials.authType === 'pat' && gitCredentials.patToken
            ? { Authorization: `Bearer ${gitCredentials.patToken}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: PlanResponse | string = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        // keep as text
      }

      if (!response.ok) {
        setError({ status: response.status, statusText: response.statusText, body: text });
        setResponse(null);
      } else {
        setResponse(data as PlanResponse);
      }
    } catch (err) {
      setError({ statusText: 'Network error', body: (err as Error).message });
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="layout-grid">
      <div>
        <PromptForm gitConfig={gitConfig} gitCredentials={gitCredentials} onSubmit={handleRun} isSubmitting={isLoading} />
        <ResultPanel data={response} error={error} isLoading={isLoading} />
      </div>
      <div>
        <GitConfigFields gitConfig={gitConfig} gitCredentials={gitCredentials} />
      </div>
    </div>
  );
}
