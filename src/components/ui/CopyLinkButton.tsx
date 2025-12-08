import { useState, useCallback } from 'react';

export interface CopyLinkButtonProps {
  getUrl: () => string;
  className?: string;
}

export function CopyLinkButton({ getUrl, className = '' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const url = getUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getUrl]);

  return (
    <button
      onClick={handleCopy}
      className={`copy-link-btn ${className}`}
      title="Copy shareable link"
    >
      {copied ? '✓ Link copied' : '🔗 Copy link'}
    </button>
  );
}
