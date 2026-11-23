import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useCart } from '../../context/CartContext';
import { Search, SlidersHorizontal, ShoppingCart, Eye, Sparkles, AlertTriangle, Package, Loader2 } from 'lucide-react';
import { getProductsApi, getCategoriesApi } from '../../api/product.api';

export default function HomeCatalog({ onSelectProduct }) {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live products and categories from backend via API Gateway
  useEffect(() => {
    Promise.all([
      getProductsApi().catch(() => ({ data: [] })),
      getCategoriesApi().catch(() => ({ data: [] }))
    ]).then(([prodRes, catRes]) => {
      if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
        setProducts(prodRes.data);
      } else {
        setProducts([]);
      }

      if (catRes && catRes.success && Array.isArray(catRes.data)) {
        const catNames = catRes.data.map(c => c.name);
        setCategories(['All', ...catNames]);
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Filter & Sort Logic
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = (product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    const ratingA = Number(a.rating) || 0;
    const ratingB = Number(b.rating) || 0;

    if (sortBy === 'price-low') return priceA - priceB;
    if (sortBy === 'price-high') return priceB - priceA;
    if (sortBy === 'rating') return ratingB - ratingA;
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
          {categories.map(cat => (
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

      {/* Loading & Empty States */}
      {isLoading ? (
        <div className="catalog-loading-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Loading live products from Product Service...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="discovery-empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="empty-icon-circle" style={{ margin: '0 auto 16px' }}>
            <Package size={40} />
          </div>
          <h3>No products found</h3>
          <p style={{ color: 'var(--text-muted, #94a3b8)' }}>
            {searchQuery || selectedCategory !== 'All'
              ? 'No products match your search or filter criteria.'
              : 'There are currently no products in the catalog.'}
          </p>
        </div>
      ) : (
        /* Product Grid */
        <div className="product-grid">
          {filteredProducts.map(product => {
            const isLowStock = product.stock <= 5;
            const price = Number(product.price) || 0;
            return (
              <div key={product.id} className="product-card">
                <div className="product-card-image-wrap" onClick={() => onSelectProduct(product)}>
                  <img src={product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'} alt={product.name} className="product-card-img" />
                  <span className="product-card-category">{product.category}</span>
                  {isLowStock && (
                    <span className="product-badge-low-stock">
                      <AlertTriangle size={12} /> Only {product.stock} left!
                    </span>
                  )}
                </div>

                <div className="product-card-details">
                  <div className="product-card-rating">★ {product.rating || '5.0'} / 5.0</div>
                  <h3 className="product-card-title" onClick={() => onSelectProduct(product)}>
                    {product.name}
                  </h3>
                  <p className="product-card-desc">{product.description}</p>

                  <div className="product-card-footer">
                    <div className="product-price">
                      <span className="currency">$</span>
                      <span className="amount">{price.toFixed(2)}</span>
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
                        onClick={() => {
                          addToCart(product, 1);
                          toast.success(`${product.name} added to cart!`);
                        }}
                        disabled={product.stock <= 0}
                      >
                        <ShoppingCart size={16} />
                        {product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
