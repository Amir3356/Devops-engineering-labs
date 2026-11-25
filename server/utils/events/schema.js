/**
 * DDL for the transactional outbox / idempotent inbox tables.
 *
 * Shared by the knex migrations and by the runtime `CREATE TABLE IF NOT EXISTS`
 * bootstrap (services create their own tables on start, like the other repositories).
 * Kept free of imports so migrations can load it without pulling in Kafka.
 */

// Events a service has committed but not yet published to Kafka.
// `seq` gives a strict publish order (created_at ties inside one transaction).
export const OUTBOX_DDL = `
  CREATE TABLE IF NOT EXISTS outbox (
    seq            BIGSERIAL PRIMARY KEY,
    id             UUID NOT NULL UNIQUE,
    aggregate_type VARCHAR(64)  NOT NULL,
    aggregate_id   VARCHAR(64)  NOT NULL,
    event_type     VARCHAR(64)  NOT NULL,
    event_version  INT          NOT NULL DEFAULT 1,
    payload        JSONB        NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMPTZ,
    attempts       INT          NOT NULL DEFAULT 0,
    last_error     TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox (seq) WHERE published_at IS NULL;
`;

// Events a consumer has already handled; the primary key makes redelivery a no-op.
export const INBOX_DDL = `
  CREATE TABLE IF NOT EXISTS inbox (
    event_id     UUID        NOT NULL,
    consumer     VARCHAR(64) NOT NULL,
    event_type   VARCHAR(64),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, consumer)
  );
`;
