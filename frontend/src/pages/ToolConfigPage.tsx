import { FormEvent, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GitConfig, GitCredentials } from '../types';

const defaultGitConfig: GitConfig = {
  repoOwner: '',
  repoName: '',
  defaultBranch: 'main',
};

const defaultGitCredentials: GitCredentials = {
  authType: 'none',
  patToken: '',
};

export default function ToolConfigPage() {
  const [gitConfig, setGitConfig] = useLocalStorage<GitConfig>('gitConfig', defaultGitConfig);
  const [gitCredentials, setGitCredentials] = useLocalStorage<GitCredentials>(
    'gitCredentials',
    defaultGitCredentials,
  );
  const [statusMessage, setStatusMessage] = useState('');

  const handleRepoSave = (event: FormEvent) => {
    event.preventDefault();
    setGitConfig({ ...gitConfig, defaultBranch: gitConfig.defaultBranch || 'main' });
    setStatusMessage('Saved repo configuration.');
  };

  const handleCredentialsSave = (event: FormEvent) => {
    event.preventDefault();
    setGitCredentials((prev) => ({
      ...prev,
      authType: gitCredentials.authType,
      patToken: gitCredentials.authType === 'pat' ? gitCredentials.patToken ?? '' : undefined,
    }));
    setStatusMessage('Saved credentials.');
  };

  return (
    <div className="page-section">
      <h2 className="section-heading">Tool Configuration</h2>

      <section style={{ marginTop: '16px' }}>
        <h3 className="section-heading">Git Tool</h3>
        <form onSubmit={handleRepoSave} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="repoOwner">Repo Owner</label>
            <input
              id="repoOwner"
              value={gitConfig.repoOwner}
              onChange={(e) => setGitConfig({ ...gitConfig, repoOwner: e.target.value })}
              placeholder="e.g. octocat"
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="repoName">Repo Name</label>
            <input
              id="repoName"
              value={gitConfig.repoName}
              onChange={(e) => setGitConfig({ ...gitConfig, repoName: e.target.value })}
              placeholder="e.g. hello-world"
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="defaultBranch">Default Branch</label>
            <input
              id="defaultBranch"
              value={gitConfig.defaultBranch}
              onChange={(e) => setGitConfig({ ...gitConfig, defaultBranch: e.target.value })}
              placeholder="main"
            />
          </div>
          <button type="submit">Save Repo Config</button>
        </form>

        <form onSubmit={handleCredentialsSave}>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="authType">Authentication Type</label>
            <select
              id="authType"
              value={gitCredentials.authType}
              onChange={(e) => setGitCredentials({ ...gitCredentials, authType: e.target.value as GitCredentials['authType'] })}
            >
              <option value="none">None</option>
              <option value="pat">Personal Access Token</option>
            </select>
          </div>
          {gitCredentials.authType === 'pat' && (
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="patToken">PAT Token</label>
              <input
                id="patToken"
                type="password"
                value={gitCredentials.patToken ?? ''}
                onChange={(e) => setGitCredentials({ ...gitCredentials, patToken: e.target.value })}
                placeholder="ghp_..."
              />
              <div className="helper-text">Stored locally in your browser only.</div>
            </div>
          )}
          <button type="submit">Save Credentials</button>
        </form>
        {statusMessage && <div className="status-text">{statusMessage}</div>}
      </section>
    </div>
  );
}
