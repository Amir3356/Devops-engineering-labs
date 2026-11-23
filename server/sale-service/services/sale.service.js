import saleRepository from '../repositories/sale.repository.js';

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

    const unitPrice = parseFloat(payload.unitPrice) || 0.0;
    const totalAmount = parseFloat(payload.totalAmount) || (unitPrice * qty);
    const saleId = payload.saleId || payload.orderId || `ord-${Date.now().toString().slice(-6)}`;

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
      customerEmail: payload.customerEmail || '',
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
