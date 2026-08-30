type InfoTipProps = {
  label: string;
};

export function InfoTip({ label }: InfoTipProps) {
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-btn" aria-label={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 11v5M12 8h.01"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="info-tip-text" role="tooltip">
        {label}
      </span>
    </span>
  );
}
