import { Link } from 'react-router-dom';
import { GitConfig, GitCredentials } from '../types';

interface GitConfigFieldsProps {
  gitConfig: GitConfig;
  gitCredentials: GitCredentials;
}

export default function GitConfigFields({ gitConfig, gitCredentials }: GitConfigFieldsProps) {
  return (
    <div className="page-section git-config-summary">
      <h3 className="section-heading">Git Tool Configuration</h3>
      <div>
        <div><strong>Repo Owner:</strong> {gitConfig.repoOwner || 'Not set'}</div>
        <div><strong>Repo Name:</strong> {gitConfig.repoName || 'Not set'}</div>
        <div><strong>Default Branch:</strong> {gitConfig.defaultBranch || 'main'}</div>
        <div><strong>Auth Type:</strong> {gitCredentials.authType === 'pat' ? 'Personal Access Token' : 'None'}</div>
        {gitCredentials.authType === 'pat' && (
          <div className="helper-text">PAT token stored locally only.</div>
        )}
      </div>
      <div style={{ marginTop: '12px' }}>
        <Link to="/config" className="nav-link" style={{ padding: '8px 10px' }}>
          Edit in Tool Config
        </Link>
      </div>
    </div>
  );
}
