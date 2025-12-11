import { FormEvent, useState } from 'react';
import { GitConfig, GitCredentials } from '../types';

interface PromptFormProps {
  gitConfig: GitConfig;
  gitCredentials: GitCredentials;
  onSubmit: (payload: { prompt: string; gitConfig: GitConfig; gitCredentials: GitCredentials }) => void;
  isSubmitting?: boolean;
}

export default function PromptForm({ gitConfig, gitCredentials, onSubmit, isSubmitting }: PromptFormProps) {
  const [prompt, setPrompt] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setLocalError('Please enter a prompt.');
      return;
    }
    if (!gitConfig.repoOwner || !gitConfig.repoName) {
      setLocalError('Please configure a repo owner and name in Tool Config.');
      return;
    }
    setLocalError(null);
    onSubmit({ prompt, gitConfig, gitCredentials });
  };

  return (
    <form onSubmit={handleSubmit} className="page-section">
      <div>
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          placeholder="Describe your goal for the AI Git Agent..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
        />
      </div>
      {localError && <div className="error-text">{localError}</div>}
      <div className="form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Running...' : 'Run'}
        </button>
      </div>
    </form>
  );
}
