import saleRepository from '../repositories/sale.repository.js';
import { deductStock, restoreStock, sendReceiptEmail } from './serviceClients.js';

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
      await restoreStock(payload.productId, qty).catch(() => {});
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

    // 3. Email the receipt in the background; a mail problem never undoes a recorded sale
    let notification = { status: 'skipped', reason: 'No customer email given' };
    if (customerEmail) {
      sendReceiptEmail({
        to: customerEmail,
        customerName: payload.customerName,
        saleId,
        productName: payload.productName.trim(),
        category: payload.category,
        quantity: qty,
        unitPrice,
        totalAmount,
        createdAt: new Date().toISOString()
      })
        .then(() => console.log(`[Sale Service] Receipt for ${saleId} emailed to ${customerEmail}`))
        .catch((err) => console.error(`[Sale Service] Receipt email for ${saleId} failed:`, err.message));
      notification = { status: 'queued', to: customerEmail };
    }

    const json = typeof sale?.toJSON === 'function' ? sale.toJSON() : sale;
    return { ...json, notification };
  }

  saveSale(payload, { qty, unitPrice, totalAmount, saleId, customerEmail }) {
    return saleRepository.create({
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
    });
  }

  async deleteSale(id) {
    const existing = await this.getSaleById(id);
    await saleRepository.delete(id);
    return existing;
  }
}

export default new SaleService();
