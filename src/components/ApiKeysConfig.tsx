import { useState, useEffect } from 'react';
import {
  API_KEY_CONFIGS,
  getApiKey,
  setApiKey,
  clearApiKey,
  type ApiKeyId,
} from '../lib/api-keys';

export function ApiKeysConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved: Record<string, boolean> = {};
    for (const config of API_KEY_CONFIGS) {
      saved[config.id] = !!getApiKey(config.id);
    }
    setSavedKeys(saved);
  }, []);

  const handleSave = (id: ApiKeyId) => {
    const value = keyValues[id];
    if (value?.trim()) {
      setApiKey(id, value);
      setSavedKeys((prev) => ({ ...prev, [id]: true }));
      setKeyValues((prev) => ({ ...prev, [id]: '' }));
    }
  };

  const handleClear = (id: ApiKeyId) => {
    clearApiKey(id);
    setSavedKeys((prev) => ({ ...prev, [id]: false }));
    setKeyValues((prev) => ({ ...prev, [id]: '' }));
  };

  const configuredCount = Object.values(savedKeys).filter(Boolean).length;

  return (
    <div className="api-keys-config">
      <button
        type="button"
        className="api-keys-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="toggle-icon">{isOpen ? '▼' : '▶'}</span>
        <span>API Keys</span>
        {configuredCount > 0 && (
          <span className="api-keys-count">{configuredCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="api-keys-content">
          <p className="api-keys-description">
            Configure your own API keys for higher rate limits. Keys are stored
            in your browser's local storage.
          </p>

          {API_KEY_CONFIGS.map((config) => (
            <div key={config.id} className="api-key-item">
              <div className="api-key-header">
                <span className="api-key-name">{config.name}</span>
                {savedKeys[config.id] ? (
                  <span className="api-key-status api-key-status-configured">
                    Configured
                  </span>
                ) : (
                  <span className="api-key-status api-key-status-not-configured">
                    Not configured
                  </span>
                )}
              </div>
              <p className="api-key-desc">{config.description}</p>

              <div className="api-key-form">
                <input
                  type="password"
                  placeholder={
                    savedKeys[config.id]
                      ? 'Enter new key to replace...'
                      : 'Paste your API key...'
                  }
                  value={keyValues[config.id] || ''}
                  onChange={(e) =>
                    setKeyValues((prev) => ({
                      ...prev,
                      [config.id]: e.target.value,
                    }))
                  }
                  className="api-key-input"
                />
                <div className="api-key-actions">
                  <button
                    type="button"
                    onClick={() => handleSave(config.id)}
                    className="btn-primary btn-small"
                    disabled={!keyValues[config.id]?.trim()}
                  >
                    Save
                  </button>
                  {savedKeys[config.id] && (
                    <button
                      type="button"
                      onClick={() => handleClear(config.id)}
                      className="btn-secondary btn-small"
                    >
                      Clear
                    </button>
                  )}
                  <a
                    href={config.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="api-key-link"
                  >
                    Get key →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
