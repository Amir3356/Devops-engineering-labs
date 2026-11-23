import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { X, ShoppingCart, ShieldCheck, Check, AlertTriangle, Truck } from 'lucide-react';

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  const isLowStock = product.stock <= 5;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content product-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="product-detail-layout">
          <div className="product-detail-image-box">
            <img src={product.image} alt={product.name} />
          </div>

          <div className="product-detail-info">
            <span className="detail-category-badge">{product.category}</span>
            <h2 className="detail-title">{product.name}</h2>
            <div className="detail-rating-row">
              <span className="stars">★★★★★</span>
              <span className="score">{product.rating || '5.0'}</span>
              <span className="reviews">({product.reviewsCount || 'Verified Stock'})</span>
            </div>

            <div className="detail-price-box">
              <span className="detail-price">${product.price.toFixed(2)}</span>
              <span className="detail-tax-notice">Taxes and duties included</span>
            </div>

            <p className="detail-description">{product.description}</p>

            <div className="detail-stock-indicator">
              {isLowStock ? (
                <div className="stock-alert low">
                  <AlertTriangle size={16} />
                  <span>Low Stock Alert: Only <strong>{product.stock}</strong> units remaining in Inventory Service!</span>
                </div>
              ) : (
                <div className="stock-alert in-stock">
                  <Check size={16} />
                  <span>In Stock (<strong>{product.stock}</strong> units available)</span>
                </div>
              )}
            </div>

            <div className="detail-purchase-row">
              <div className="qty-selector">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                >
                  +
                </button>
              </div>

              <button
                className={`btn-add-to-cart-large ${isAdded ? 'added' : ''}`}
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
              >
                {isAdded ? (
                  <>
                    <Check size={18} /> Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} /> Add to Cart (${(product.price * quantity).toFixed(2)})
                  </>
                )}
              </button>
            </div>

            <div className="detail-perks">
              <div className="perk-item">
                <Truck size={16} />
                <span>Free express shipping on orders over $50</span>
              </div>
              <div className="perk-item">
                <ShieldCheck size={16} />
                <span>2-year warranty & 30-day money back guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
