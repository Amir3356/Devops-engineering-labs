import purchaseRepository from '../repositories/purchase.repository.js';

class PurchaseService {
  async getAllPurchases() {
    return purchaseRepository.findAll();
  }

  async getPurchaseById(id) {
    const purchase = await purchaseRepository.findById(id);
    if (!purchase) {
      throw new Error(`Purchase record '${id}' not found`);
    }
    return purchase;
  }

  async createPurchase(payload) {
    if (!payload.productName || !payload.productName.trim()) {
      throw new Error('Product name is required for purchase batch');
    }
    const qty = parseInt(payload.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const batchId = payload.batchId || `BAT-${Date.now().toString().slice(-4)}-2026`;
    const unitCost = parseFloat(payload.unitCost) || 0.0;
    const totalCost = parseFloat(payload.totalCost) || (unitCost * qty);

    return purchaseRepository.create({
      id: payload.id || `pur-${Date.now()}`,
      batchId,
      productName: payload.productName.trim(),
      category: payload.category || 'General',
      quantity: qty,
      supplier: payload.supplier || '',
      unitCost,
      totalCost,
      status: payload.status || 'Paid',
      createdAt: new Date().toISOString()
    });
  }

  async updatePurchase(id, payload) {
    const existing = await this.getPurchaseById(id);
    const qty = payload.quantity !== undefined ? parseInt(payload.quantity, 10) : existing.quantity;
    const unitCost = payload.unitCost !== undefined ? parseFloat(payload.unitCost) : existing.unitCost;
    // Keep the total the admin entered; only derive it when it wasn't sent
    const totalCost = payload.totalCost !== undefined ? parseFloat(payload.totalCost) : unitCost * qty;

    return purchaseRepository.update(id, {
      ...payload,
      quantity: qty,
      unitCost,
      totalCost
    });
  }

  async deletePurchase(id) {
    const existing = await this.getPurchaseById(id);
    await purchaseRepository.delete(id);
    return existing;
  }
}

export default new PurchaseService();
