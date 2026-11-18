/**
 * The shape of a dashboard page, shown while the real one renders.
 *
 * It deliberately mirrors the common layout (page head, KPI row, panel with
 * rows) so the swap to real content does not jump the page around.
 */
export function PageSkeleton({ rows = 5, kpis = 4 }: { rows?: number; kpis?: number }) {
  return (
    <div className="dash-content skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton-head">
        <span className="skeleton-line title" />
        <span className="skeleton-line sub" />
      </div>

      {kpis > 0 ? (
        <div className="skeleton-kpis">
          {Array.from({ length: kpis }, (_, index) => (
            <span className="skeleton-kpi" key={index} />
          ))}
        </div>
      ) : null}

      <div className="skeleton-panel">
        <span className="skeleton-line title" style={{ width: 180, height: 20 }} />
        <div className="skeleton-rows">
          {Array.from({ length: rows }, (_, index) => (
            <div className="skeleton-row" key={index}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
