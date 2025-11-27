import { useState } from 'react';
import { useAbiStorage } from '../hooks';

export function AbiManager() {
  const { abis, addAbi, removeAbi, error, clearError } = useAbiStorage();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [abiJson, setAbiJson] = useState('');

  const handleAdd = () => {
    const success = addAbi(name, abiJson);
    if (success) {
      setName('');
      setAbiJson('');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAbiJson(text);
      clearError();
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div className="abi-manager">
      <button
        type="button"
        className="abi-manager-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="toggle-icon">{isOpen ? '▼' : '▶'}</span>
        <span>Custom ABIs</span>
        {abis.length > 0 && (
          <span className="abi-count">{abis.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="abi-manager-content">
          <div className="abi-add-form">
            <div className="abi-form-row">
              <input
                type="text"
                placeholder="ABI name (e.g., MyToken)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError();
                }}
                className="abi-name-input"
              />
            </div>
            <div className="abi-form-row">
              <textarea
                placeholder="Paste ABI JSON here..."
                value={abiJson}
                onChange={(e) => {
                  setAbiJson(e.target.value);
                  clearError();
                }}
                className="abi-json-input"
                rows={4}
              />
            </div>
            <div className="abi-form-actions">
              <button
                type="button"
                onClick={handlePaste}
                className="btn-secondary"
              >
                Paste from clipboard
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="btn-primary"
                disabled={!name.trim() || !abiJson.trim()}
              >
                Add ABI
              </button>
            </div>
            {error && <div className="abi-error">{error}</div>}
          </div>

          {abis.length > 0 && (
            <div className="abi-list">
              <div className="abi-list-header">Saved ABIs</div>
              {abis.map((abi) => (
                <div key={abi.id} className="abi-item">
                  <div className="abi-item-info">
                    <span className="abi-item-name">{abi.name}</span>
                    <span className="abi-item-meta">
                      {abi.selectors.length} function
                      {abi.selectors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAbi(abi.id)}
                    className="abi-delete-btn"
                    title="Delete ABI"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {abis.length === 0 && (
            <p className="abi-empty-hint">
              Add contract ABIs to decode custom function calls.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
