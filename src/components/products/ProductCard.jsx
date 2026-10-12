import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import './ProductCard.css';
import AddToCartButton from '../cart/AddToCartButton';

function ProductCard({ product }) {
  const hasImage = Boolean(product.imageUrl);

  const meta = product.frameType
    ? `${product.category} | ${product.frameType}`
    : product.category;

  return (
    <article className="product-card">
      <Link
        className="product-card__link"
        to={`/products/${product.id}`}
        aria-label={`View ${product.name}`}
      >
        <div className="product-card__image-wrap">
          {hasImage ? (
            <img
              className="product-card__image"
              src={product.imageUrl}
              alt={product.imageAlt || `${product.name} product image`}
            />
          ) : (
            <div
              className="product-card__image"
              role="img"
              aria-label={`${product.name} image unavailable`}
            >
              Image unavailable
            </div>
          )}
        </div>

        <div className="product-card__body">
          <p className="product-card__brand">{product.brand}</p>
          <h2 className="product-card__name">{product.name}</h2>

          <p className="product-card__meta">{meta}</p>

          <div className="product-card__price-row">
            <strong>{formatCurrency(product.price)}</strong>

            {product.originalPrice > product.price ? (
              <span>{formatCurrency(product.originalPrice)}</span>
            ) : null}
          </div>

          <span className="product-card__details">View details</span>
        </div>
      </Link>

      <div className="product-card__cart-action">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}

export default ProductCard;
