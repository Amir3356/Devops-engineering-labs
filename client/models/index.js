/**
 * Client data models
 * ------------------
 * The shapes the UI works with, independent of how each backend service
 * stores or serialises its data.
 *
 *   API response ──createX()──▶ UI model ──xFormToApi()──▶ request body
 *
 * Rules:
 *  - Call createX()/createXList() once, where data enters the app
 *    (api/ or services/), so components only ever see clean models.
 *  - Components never read snake_case fields or guess between aliases.
 *  - Derived values (low stock, unread count, totals) live here, not in JSX.
 */
export * from './Product';
export * from './Category';
export * from './User';
export * from './CartItem';
export * from './Order';
export * from './InventoryItem';
export * from './Purchase';
export * from './Notification';
