import saleRepository from '../repositories/sale.repository.js';
import pool from '../config/db.js';
import { deductStock, restoreStock } from './serviceClients.js';
import { withTransaction, appendEvent } from '../../utils/events/index.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class SaleService {
  async getAllSales() {
    return saleRepository.findAll();
  }

  async getSaleById(id) {
    const sale = await saleRepository.findById(id);
    if (!sale) {
      throw new Error(`Sale transaction '${id}' not found`);
    }
    return sale;
  }

  async recordSale(payload) {
    if (!payload.productName || !payload.productName.trim()) {
      throw new Error('Product name is required for sale transaction');
    }
    const qty = parseInt(payload.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const customerEmail = String(payload.customerEmail || '').trim();
    if (customerEmail && !EMAIL.test(customerEmail)) {
      throw new Error('Customer email is not a valid email address');
    }
    if (!payload.productId) {
      throw new Error('productId is required so the sale can take its units from inventory');
    }

    // 1. Take the units out of stock first; the price is the inventory unit selling price
    const stockRow = await deductStock(payload.productId, qty);
    const unitPrice = Number(stockRow?.unitSellingPrice);
    if (!(unitPrice > 0)) {
      // No price set yet: put the units back and refuse the sale
      await restoreStock(payload.productId, qty).catch((e) =>
        console.error(`[Sale Service] Stock restore for unpriced product ${payload.productId} (x${qty}) failed:`, e.message)
      );
      const err = new Error('This product has no unit selling price yet. Set it in Inventory first.');
      err.status = 409;
      throw err;
    }
    const totalAmount = Math.round(unitPrice * qty * 100) / 100;
    const saleId = payload.saleId || `SALE-${Date.now().toString().slice(-6)}`;

    // 2. Save the sale (put the stock back if that fails)
    let sale;
    try {
      sale = await this.saveSale(payload, { qty, unitPrice, totalAmount, saleId, customerEmail });
    } catch (err) {
      await restoreStock(payload.productId, qty).catch((e) =>
        console.error('[Sale Service] Stock restore after failed save also failed:', e.message)
      );
      throw err;
    }

    // 3. The receipt email is driven by the SaleRecorded event committed with the sale;
    //    a mail problem never undoes a recorded sale
    const notification = customerEmail
      ? { status: 'queued', to: customerEmail }
      : { status: 'skipped', reason: 'No customer email given' };

    const json = typeof sale?.toJSON === 'function' ? sale.toJSON() : sale;
    return { ...json, notification };
  }

  /** Saves the sale and its SaleRecorded event in one transaction (transactional outbox). */
  saveSale(payload, { qty, unitPrice, totalAmount, saleId, customerEmail }) {
    return withTransaction(pool, async (client) => {
      const sale = await saleRepository.create(
        {
          id: payload.id || `sale-${Date.now()}`,
          saleId,
          batchId: payload.batchId || '',
          productId: payload.productId || '',
          productName: payload.productName.trim(),
          category: payload.category || 'General',
          quantity: qty,
          unitPrice,
          totalAmount,
          customerName: payload.customerName || 'Direct Customer',
          customerEmail,
          customerPhone: payload.customerPhone || '',
          paymentStatus: payload.paymentStatus || 'Paid',
          fulfillmentStatus: payload.fulfillmentStatus || 'Delivered',
          createdAt: payload.createdAt || new Date().toISOString()
        },
        client
      );
      await appendEvent(client, {
        aggregateType: 'sale',
        aggregateId: sale.saleId,
        type: 'SaleRecorded',
        payload: {
          id: sale.id,
          saleId: sale.saleId,
          productId: sale.productId,
          productName: sale.productName,
          category: sale.category,
          quantity: sale.quantity,
          unitPrice: Number(sale.unitPrice),
          totalAmount: Number(sale.totalAmount),
          paymentStatus: sale.paymentStatus,
          createdAt: sale.createdAt,
          customer: { name: sale.customerName, email: customerEmail || null }
        }
      });
      return sale;
    });
  }

  async deleteSale(id) {
    const existing = await this.getSaleById(id);
    await saleRepository.delete(id);
    return existing;
  }
}

export default new SaleService();
