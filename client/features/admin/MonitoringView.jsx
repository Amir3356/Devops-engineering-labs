import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * Admin → Monitoring: the provisioned Grafana dashboard (Prometheus metrics from every
 * service, Kafka, PostgreSQL and both Redis instances), embedded read-only in kiosk mode.
 * Grafana runs in docker-compose (`grafana`, host port 3001) with anonymous Viewer access.
 */

const GRAFANA_URL = (import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3001').replace(/\/$/, '');
const PROMETHEUS_URL = (import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9090').replace(/\/$/, '');
const DASHBOARD_PATH = '/d/nexuscommerce-overview/nexuscommerce-system-overview';

const RANGES = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' }
];

const dashboardUrl = (range, { kiosk }) =>
  `${GRAFANA_URL}${DASHBOARD_PATH}?orgId=1&from=now-${range}&to=now&refresh=10s&theme=light${kiosk ? '&kiosk' : ''}`;

export default function MonitoringView() {
  const [range, setRange] = useState('1h');
  const [status, setStatus] = useState('checking'); // 'checking' | 'up' | 'down'
  const [frameKey, setFrameKey] = useState(0);

  // Grafana sends no CORS headers, so an opaque no-cors request is used purely as a reachability probe
  const probe = () =>
    fetch(`${GRAFANA_URL}/api/health`, { mode: 'no-cors', cache: 'no-store' })
      .then(() => setStatus('up'))
      .catch(() => setStatus('down'));
  useEffect(() => {
    probe();
  }, []);

  const reload = () => {
    setStatus('checking');
    probe();
    setFrameKey((k) => k + 1);
  };

  return (
    <div className="monitoring-view">
      <div className="monitoring-toolbar">
        <label className="monitoring-range">
          <span>Time range</span>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <div className="monitoring-actions">
          <button type="button" className="monitoring-btn" onClick={reload}>
            <RefreshCw size={15} /> Reload
          </button>
          <a className="monitoring-btn" href={dashboardUrl(range, { kiosk: false })} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Open in Grafana
          </a>
          <a className="monitoring-btn" href={PROMETHEUS_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Prometheus
          </a>
        </div>
      </div>

      {status === 'down' ? (
        <div className="monitoring-offline" role="alert">
          <AlertTriangle size={28} />
          <h3>Grafana isn&apos;t reachable at {GRAFANA_URL}</h3>
          <p>Start the monitoring stack, then reload:</p>
          <code>docker compose up -d prometheus grafana postgres-exporter redis-exporter kafka-exporter</code>
          <button type="button" className="monitoring-btn" onClick={reload}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      ) : (
        <iframe
          key={`${frameKey}-${range}`}
          className="monitoring-frame"
          title="NexusCommerce system monitoring (Grafana)"
          src={dashboardUrl(range, { kiosk: true })}
          loading="lazy"
        />
      )}
    </div>
  );
}
