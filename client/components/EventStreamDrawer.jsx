import { useState } from 'react';
import { useEvents } from '../context/EventContext';
import { X, Zap, Trash2, ChevronDown, ChevronRight, Activity, Cpu } from 'lucide-react';

export default function EventStreamDrawer() {
  const { events, isDrawerOpen, closeDrawer, clearEvents } = useEvents();
  const [expandedEventId, setExpandedEventId] = useState(null);

  if (!isDrawerOpen) return null;

  const getEventBadgeColor = (name) => {
    if (name.includes('User')) return 'badge-user';
    if (name.includes('Product')) return 'badge-product';
    if (name.includes('Cart')) return 'badge-cart';
    if (name.includes('Order')) return 'badge-order';
    if (name.includes('Payment')) return 'badge-payment';
    if (name.includes('Stock')) return 'badge-inventory';
    return 'badge-default';
  };

  const toggleExpand = (id) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  return (
    <div className="event-drawer-backdrop" onClick={closeDrawer}>
      <div className="event-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="event-drawer-header">
          <div className="event-drawer-title">
            <Zap className="text-amber-400" size={22} />
            <div>
              <h3>Node.js EventEmitter Stream</h3>
              <p className="event-drawer-sub">Live Pub/Sub Activity Log across Microservices</p>
            </div>
          </div>
          <div className="event-drawer-controls">
            <button className="btn-icon" onClick={clearEvents} title="Clear history">
              <Trash2 size={16} />
            </button>
            <button className="btn-icon" onClick={closeDrawer} title="Close drawer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Architecture Info Pill */}
        <div className="event-architecture-banner">
          <Cpu size={16} />
          <span>
            Events emitted via <strong>EventEmitter.emit()</strong> in memory. Listeners react decoupled across services.
          </span>
        </div>

        {/* Event List */}
        <div className="event-list-container">
          {events.length === 0 ? (
            <div className="event-empty-state">
              <Activity size={40} className="empty-icon" />
              <p>No events emitted yet.</p>
              <small>Perform an action like registering, adding to cart, or checking out to watch events fire!</small>
            </div>
          ) : (
            events.map((evt) => {
              const isExpanded = expandedEventId === evt.eventId;
              return (
                <div key={evt.eventId} className="event-card">
                  <div className="event-card-header" onClick={() => toggleExpand(evt.eventId)}>
                    <div className="event-card-left">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className={`event-tag ${getEventBadgeColor(evt.eventName)}`}>
                        {evt.eventName}
                      </span>
                      <span className="event-source">[{evt.source}]</span>
                    </div>
                    <span className="event-timestamp">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="event-card-body">
                      <div className="event-meta-row">
                        <span className="meta-label">Event ID:</span>
                        <code className="meta-code">{evt.eventId}</code>
                      </div>
                      <div className="event-meta-row">
                        <span className="meta-label">Timestamp:</span>
                        <span className="meta-val">{evt.timestamp}</span>
                      </div>
                      <div className="event-payload-box">
                        <div className="payload-title">Data Payload (Contract):</div>
                        <pre className="payload-json">{JSON.stringify(evt.data, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
