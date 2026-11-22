import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { Search, SlidersHorizontal, ShoppingCart, Eye, Sparkles, AlertTriangle } from 'lucide-react';
import { getProductsApi } from '../../api/product.api';

export const INITIAL_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'AeroPulse Wireless Noise-Cancelling Headphones',
    category: 'Audio',
    price: 249.99,
    stock: 18,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    description: 'High-fidelity acoustic drivers with 40-hour battery life and adaptive hybrid noise cancellation.'
  },
  {
    id: 'prod-002',
    name: 'Quantum Lumina Mechanical Keyboard (RGB)',
    category: 'Electronics',
    price: 139.50,
    stock: 4, // Low stock demo!
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    description: 'Aircraft-grade anodized aluminum frame with hot-swappable linear mechanical switches and per-key RGB backlighting.'
  },
  {
    id: 'prod-003',
    name: 'Titan Pro Ultra Smartwatch',
    category: 'Wearables',
    price: 329.00,
    stock: 12,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    description: 'Sapphire glass display with continuous ECG tracking, dual-frequency GPS, and 100m water resistance.'
  },
  {
    id: 'prod-004',
    name: 'OpticGlide Ergonomic Wireless Mouse',
    category: 'Electronics',
    price: 79.99,
    stock: 25,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
    description: 'Sculpted ergonomic grip with hyper-fast MagSpeed scrolling and 8,000 DPI track-on-glass sensor.'
  },
  {
    id: 'prod-005',
    name: 'SonicSphere 360 Portable Bluetooth Speaker',
    category: 'Audio',
    price: 119.00,
    stock: 3, // Low stock demo!
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
    description: 'Deep spatial 360-degree acoustic projection with IPX7 waterproof enclosure and 15-hour playtime.'
  },
  {
    id: 'prod-006',
    name: 'HyperCharge 65W GaN Fast Charger',
    category: 'Accessories',
    price: 49.99,
    stock: 40,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
    description: 'Next-generation Gallium Nitride (GaN) fast charger with dual USB-C Power Delivery ports.'
  }
];

export const CATEGORIES = ['All', 'Audio', 'Electronics', 'Wearables', 'Accessories'];

export default function HomeCatalog({ onSelectProduct }) {
  const { addToCart } = useCart();
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');

  // Fetch live products from backend via API Gateway
  useEffect(() => {
    getProductsApi()
      .then(res => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setProducts(res.data);
        }
      })
      .catch(err => {
        console.warn('[HomeCatalog] Using fallback products catalog:', err.message);
      });
  }, []);

  // Filter & Sort Logic
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0; // featured
  });

  return (
    <div className="catalog-view">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} /> Microservices E-Commerce Architecture
          </div>
          <h1>Next-Gen Shopping Engineered with Microservices</h1>
          <p>
            Experience pure decoupling: Independent services, isolated databases, and 
            real-time Node.js EventEmitter workflows under the hood.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search products by title, specs, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-chips">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="sort-selector">
          <SlidersHorizontal size={16} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="product-grid">
        {filteredProducts.map(product => {
          const isLowStock = product.stock <= 5;
          return (
            <div key={product.id} className="product-card">
              <div className="product-card-image-wrap" onClick={() => onSelectProduct(product)}>
                <img src={product.image} alt={product.name} className="product-card-img" />
                <span className="product-card-category">{product.category}</span>
                {isLowStock && (
                  <span className="product-badge-low-stock">
                    <AlertTriangle size={12} /> Only {product.stock} left!
                  </span>
                )}
              </div>

              <div className="product-card-details">
                <div className="product-card-rating">★ {product.rating} / 5.0</div>
                <h3 className="product-card-title" onClick={() => onSelectProduct(product)}>
                  {product.name}
                </h3>
                <p className="product-card-desc">{product.description}</p>

                <div className="product-card-footer">
                  <div className="product-price">
                    <span className="currency">$</span>
                    <span className="amount">{product.price.toFixed(2)}</span>
                  </div>

                  <div className="product-card-actions">
                    <button
                      className="btn-quick-view"
                      onClick={() => onSelectProduct(product)}
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="btn-add-cart"
                      onClick={() => addToCart(product, 1)}
                    >
                      <ShoppingCart size={16} />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
