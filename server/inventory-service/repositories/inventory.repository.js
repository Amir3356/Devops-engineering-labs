import pool from '../config/db.js';
import InventoryModel from '../models/inventory.model.js';
import { ensureOutboxTable } from '../../utils/events/index.js';

/**
 * Inventory Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'inventory_db' database.
 */
class InventoryRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_stock (
          product_id VARCHAR(64) PRIMARY KEY,
          product_name VARCHAR(128) NOT NULL,
          stock_quantity INT NOT NULL DEFAULT 0,
          low_stock_threshold INT NOT NULL DEFAULT 5,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        -- Batch details recorded when stock is added from a purchase batch
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS category VARCHAR(128);
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS expires_at DATE;
        -- Selling prices set when a batch is stocked (unit = total ÷ batch quantity)
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS unit_selling_price NUMERIC(10, 2);
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS total_selling_price NUMERIC(12, 2);
        -- Optimistic concurrency control: bumped by every write, checked by "set stock" edits
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;
        -- Backstop: no code path may ever push stock below zero
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_quantity_non_negative') THEN
            ALTER TABLE inventory_stock ADD CONSTRAINT inventory_stock_quantity_non_negative
              CHECK (stock_quantity >= 0) NOT VALID;
          END IF;
        END $$;
      `);
      // Saga replies (StockReserved / StockRejected / StockRestored) go through the outbox
      await ensureOutboxTable(pool);
    } catch (err) {
      console.error('[Inventory Repository] PostgreSQL init error:', err.message);
    }
  }

  // DATE columns come back as local-midnight Date objects; keep them as YYYY-MM-DD
  static toDateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  mapRow(r) {
    if (!r) return null;
    return new InventoryModel({
      productId: r.product_id,
      productName: r.product_name,
      category: r.category,
      batchId: r.batch_id,
      expiresAt: InventoryRepository.toDateOnly(r.expires_at),
      unitSellingPrice: r.unit_selling_price,
      totalSellingPrice: r.total_selling_price,
      stockQuantity: r.stock_quantity,
      lowStockThreshold: r.low_stock_threshold,
      version: r.version ?? 0,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock ORDER BY product_id ASC');
    return res.rows.map(r => this.mapRow(r));
  }

  async findByProductId(productId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock WHERE product_id = $1', [productId]);
    return this.mapRow(res.rows[0]);
  }

  async getLowStock() {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock WHERE stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC');
    return res.rows.map(r => this.mapRow(r));
  }

  /**
   * Set an absolute stock value (admin edit). Pass `expectedVersion` (the version the admin
   * loaded) for optimistic concurrency control: if any order, sale or restock changed the row
   * since, nothing is written and a 409 error reports the current stock instead of silently
   * overwriting it (lost update).
   */
  async updateStock(productId, stockQuantity, options = null) {
    await this.ready;
    const opts = typeof options === 'string' ? { productName: options } : (options || {});
    const { productName, category, batchId, expiresAt, unitSellingPrice, totalSellingPrice, expectedVersion } = opts;

    const existing = await pool.query('SELECT * FROM inventory_stock WHERE product_id = $1', [productId]);
    if (existing.rows.length === 0) {
      const res = await pool.query(`
        INSERT INTO inventory_stock (product_id, product_name, stock_quantity, category, batch_id, expires_at, unit_selling_price, total_selling_price, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *;
      `, [
        productId, productName || 'Product', stockQuantity, category || null, batchId || null, expiresAt || null,
        unitSellingPrice ?? null, totalSellingPrice ?? null
      ]);
      return this.mapRow(res.rows[0]);
    }

    const updates = ['stock_quantity = $2', 'updated_at = NOW()', 'version = inventory_stock.version + 1'];
    const params = [productId, stockQuantity];
    let paramIndex = 3;

    if (productName) {
      updates.push(`product_name = $${paramIndex++}`);
      params.push(productName);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(category || null);
    }
    if (batchId !== undefined) {
      updates.push(`batch_id = $${paramIndex++}`);
      params.push(batchId || null);
    }
    if (expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      params.push(expiresAt || null);
    }
    if (totalSellingPrice !== undefined && unitSellingPrice !== undefined) {
      updates.push(`unit_selling_price = $${paramIndex++}`);
      params.push(unitSellingPrice);
      updates.push(`total_selling_price = $${paramIndex++}`);
      params.push(totalSellingPrice);
    }

    let where = 'product_id = $1';
    if (expectedVersion !== undefined && expectedVersion !== null) {
      where += ` AND version = $${paramIndex++}`;
      params.push(Number(expectedVersion));
    }

    const sql = `
      UPDATE inventory_stock
      SET ${updates.join(', ')}
      WHERE ${where}
      RETURNING *;
    `;
    const res = await pool.query(sql, params);
    if (res.rows.length === 0) {
      const current = this.mapRow((await pool.query('SELECT * FROM inventory_stock WHERE product_id = $1', [productId])).rows[0]);
      const err = new Error(current
        ? `Stock for ${current.productName} changed while you were editing (now ${current.stockQuantity}). Reload and try again.`
        : `Inventory item for product ${productId} no longer exists`);
      err.status = current ? 409 : 404;
      err.code = 'VERSION_CONFLICT';
      err.current = current ? current.toJSON() : null;
      throw err;
    }
    return this.mapRow(res.rows[0]);
  }

  /**
   * Deduct several items atomically: either every item has enough stock and all
   * are deducted, or nothing changes and an error (code INSUFFICIENT_STOCK) names the short product.
   * Pass `db` (a transaction client) to join the caller's transaction instead; the caller
   * must then roll back (e.g. to a savepoint) when this throws.
   */
  async deductMany(items, db = null) {
    await this.ready;
    if (db) return this.deductEach(items, db);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await this.deductEach(items, client);
      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Concurrency control for checkout:
   *  1. merge duplicate lines (same product twice in one order)
   *  2. lock every row with SELECT … FOR UPDATE, always in product_id order — a fixed lock
   *     order means two orders for [A, B] and [B, A] queue up instead of deadlocking
   *  3. check all quantities while holding the locks, then deduct
   * Concurrent buyers of the last unit serialize on the row lock: the first commits, the
   * next sees 0 left and gets INSUFFICIENT_STOCK. The CHECK constraint is a final backstop.
   */
  /**
   * Lock stock rows in one global order (PostgreSQL's ORDER BY product_id). Every multi-row
   * write takes its locks through here, so no two transactions can wait on each other in a cycle.
   * @returns {Map<string, object>} locked rows by product id (missing products are absent)
   */
  async lockRowsInOrder(productIds, client) {
    const locked = await client.query(
      `SELECT product_id, product_name, stock_quantity
       FROM inventory_stock WHERE product_id = ANY($1::text[])
       ORDER BY product_id
       FOR UPDATE`,
      [productIds.map(String)]
    );
    return new Map(locked.rows.map((r) => [r.product_id, r]));
  }

  async deductEach(items, client) {
    const wanted = new Map();
    for (const { productId, quantity } of items) {
      wanted.set(String(productId), (wanted.get(String(productId)) || 0) + Number(quantity));
    }
    const productIds = [...wanted.keys()].sort();
    const rows = await this.lockRowsInOrder(productIds, client);

    for (const productId of productIds) {
      const row = rows.get(productId);
      const quantity = wanted.get(productId);
      if (!row || row.stock_quantity < quantity) {
        const err = new Error(row
          ? `Not enough stock for ${row.product_name}: ${row.stock_quantity} left, ${quantity} requested`
          : `Product ${productId} is not in stock`);
        err.code = 'INSUFFICIENT_STOCK';
        err.productId = productId;
        err.available = row ? row.stock_quantity : 0;
        throw err;
      }
    }

    const updated = [];
    for (const productId of productIds) {
      const res = await client.query(
        `UPDATE inventory_stock
         SET stock_quantity = stock_quantity - $1, updated_at = NOW(), version = version + 1
         WHERE product_id = $2
         RETURNING *`,
        [wanted.get(productId), productId]
      );
      updated.push(this.mapRow(res.rows[0]));
    }
    return updated;
  }

  async deductStock(productId, quantity) {
    await this.ready;
    const res = await pool.query(`
      UPDATE inventory_stock
      SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW(), version = version + 1
      WHERE product_id = $2 AND stock_quantity >= $1
      RETURNING *;
    `, [quantity, productId]);

    return this.mapRow(res.rows[0]);
  }

  /**
   * Add stock from a purchase batch. Creates the product's stock row if needed
   * and records the latest batch id, category and expiry date.
   */
  async addBatchStock({ productId, productName, category, batchId, expiresAt, quantity, unitSellingPrice, totalSellingPrice }) {
    await this.ready;
    const res = await pool.query(`
      INSERT INTO inventory_stock (product_id, product_name, stock_quantity, category, batch_id, expires_at, unit_selling_price, total_selling_price, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (product_id) DO UPDATE SET
        stock_quantity = inventory_stock.stock_quantity + EXCLUDED.stock_quantity,
        product_name = EXCLUDED.product_name,
        category = COALESCE(EXCLUDED.category, inventory_stock.category),
        batch_id = COALESCE(EXCLUDED.batch_id, inventory_stock.batch_id),
        expires_at = COALESCE(EXCLUDED.expires_at, inventory_stock.expires_at),
        unit_selling_price = COALESCE(EXCLUDED.unit_selling_price, inventory_stock.unit_selling_price),
        total_selling_price = COALESCE(EXCLUDED.total_selling_price, inventory_stock.total_selling_price),
        updated_at = NOW(),
        version = inventory_stock.version + 1
      RETURNING *;
    `, [
      productId, productName, quantity, category || null, batchId || null, expiresAt || null,
      unitSellingPrice ?? null, totalSellingPrice ?? null
    ]);

    return this.mapRow(res.rows[0]);
  }

  async replenishStock(productId, quantity, db = pool) {
    await this.ready;
    const res = await db.query(`
      UPDATE inventory_stock
      SET stock_quantity = stock_quantity + $1, updated_at = NOW(), version = version + 1
      WHERE product_id = $2
      RETURNING *;
    `, [quantity, productId]);

    return this.mapRow(res.rows[0]);
  }

  async deleteStock(productId) {
    await this.ready;
    const res = await pool.query('DELETE FROM inventory_stock WHERE product_id = $1 RETURNING *', [productId]);
    return this.mapRow(res.rows[0]);
  }
}

export default new InventoryRepository();
