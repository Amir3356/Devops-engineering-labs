export { TOPICS, topicForAggregate, dlqTopic, getKafka, getProducer, disconnectProducer } from './kafka.js';
export { ensureOutboxTable, withTransaction, appendEvent, startOutboxRelay } from './outbox.js';
export { startConsumer, NonRetryableError } from './consumer.js';
export { OUTBOX_DDL, INBOX_DDL } from './schema.js';
export { startWithRetry, onShutdown } from './lifecycle.js';
