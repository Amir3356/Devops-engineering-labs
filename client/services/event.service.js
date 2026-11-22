import { getEventHistoryApi } from '../api/event.api';

/**
 * Domain Event Logic Service (Frontend)
 */
class EventService {
  createLocalEvent(eventName, source, data) {
    return {
      eventId: `evt-client-${Date.now()}`,
      eventName,
      timestamp: new Date().toISOString(),
      source: source || 'client-ui',
      data: data || {}
    };
  }

  async fetchHistory(limit = 30) {
    return [];
  }

  getBadgeColor(eventName) {
    if (eventName.includes('User')) return 'badge-user';
    if (eventName.includes('Product')) return 'badge-product';
    if (eventName.includes('Cart')) return 'badge-cart';
    if (eventName.includes('Order')) return 'badge-order';
    if (eventName.includes('Payment')) return 'badge-payment';
    if (eventName.includes('Stock')) return 'badge-inventory';
    return 'badge-default';
  }
}

export default new EventService();
