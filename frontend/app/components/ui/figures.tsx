export type Figure = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Said on hover. */
  hint?: string;
};

/** A row of labelled figures over a page's bars: the payee, category and tag pages. */
export function Figures({ figures }: { figures: Figure[] }): React.JSX.Element {
  return (
    <div className="seneca-payees__figures">
      {figures.map(figure => (
        <div key={figure.key} title={figure.hint}>
          <span className="seneca-payees__figure-label">{figure.label}</span>
          <span className="seneca-payees__figure-value">{figure.value}</span>
        </div>
      ))}
    </div>
  );
}
