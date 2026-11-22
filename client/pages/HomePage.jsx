import HomeCatalog from '../features/products/HomeCatalog';

/**
 * HomePage displays the product catalog showcase.
 */
export default function HomePage({ onSelectProduct }) {
  return <HomeCatalog onSelectProduct={onSelectProduct} />;
}
