import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/products/ProductCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { CATALOG_CATEGORIES, getProducts } from '../services/productService';
import heroImage from '../assets/home/hero.webp';
import menImage from '../assets/home/category-men.webp';
import womenImage from '../assets/home/category-women.webp';
import kidsImage from '../assets/home/category-kids.webp';
import sunglassesImage from '../assets/home/category-sunglasses.webp';
import promoImage from '../assets/home/promo.webp';
import './HomePage.css';

const PREVIEW_LIMIT = 6;
const categoryImages = {
  Men: menImage,
  Women: womenImage,
  Kids: kidsImage,
  Sunglasses: sunglassesImage,
};

const highlights = [
  {
    title: 'Explore collections',
    description: 'Find frames by category.',
  },
  {
    title: 'Browse real products',
    description: 'Discover eyewear from our catalogue.',
  },
  {
    title: 'View product details',
    description: 'Explore available styles and prices.',
  },
];

function HomePage() {
  useDocumentTitle('Darshana Opticals | Eyewear Studio');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setLoading(true);
      setError(false);

      try {
        const catalogue = await getProducts();
        if (active) {
          setProducts(
            Array.isArray(catalogue) ? catalogue.slice(0, PREVIEW_LIMIT) : [],
          );
        }
      } catch {
        if (active) {
          setProducts([]);
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPreview();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <div className="home-page">
      <div className="home-page__top">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">
              Darshana Opticals Eyewear Studio
            </p>
            <h1 id="home-title">
              <span className="home-page__sr-only">Darshana Opticals — </span>
              Find Your <span>Perfect</span> Vision.
            </h1>
            <p className="home-hero__description">
              Discover eyewear for your everyday style. Explore our collections
              and find frames that suit you.
            </p>
            <div className="home-hero__actions">
              <Link
                className="home-page__button home-page__button--gold"
                to="/products"
              >
                Shop Now <span aria-hidden="true">→</span>
              </Link>
              <a
                className="home-page__button home-page__button--outline"
                href="#home-collections"
              >
                Explore Styles
              </a>
            </div>
          </div>

          <div className="home-hero__visual">
            <img
              src={heroImage}
              alt="Model wearing sunglasses in an architectural walkway"
              className="home-hero__photo"
            />
            <div className="home-hero__photo-tint" aria-hidden="true" />
            <div className="home-hero__photo-note" aria-hidden="true">
              Eyewear for every style
            </div>
          </div>
        </section>

        <section className="home-highlights" aria-label="Shopping highlights">
          {highlights.map((highlight) => (
            <div className="home-highlights__item" key={highlight.title}>
              <strong>{highlight.title}</strong>
              <span>{highlight.description}</span>
            </div>
          ))}
        </section>

        <section
          className="home-collections"
          id="home-collections"
          aria-labelledby="home-collections-title"
        >
          <header className="home-page__section-heading home-page__section-heading--center">
            <p>Browse by</p>
            <h2 id="home-collections-title">Shop Collections</h2>
          </header>
          <div className="home-collections__grid">
            {CATALOG_CATEGORIES.map((category) => (
              <Link
                className={`home-collections__card home-collections__card--${category.toLowerCase()}`}
                to={`/products?category=${encodeURIComponent(category)}`}
                key={category}
                aria-label={`Shop ${category} collection`}
              >
                {categoryImages[category] ? (
                  <img
                    src={categoryImages[category]}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="home-collections__kids-graphic"
                    aria-hidden="true"
                  >
                    <span className="home-collections__kids-circle" />
                    <span className="home-collections__kids-glasses">◡ ◡</span>
                  </span>
                )}
                <span className="home-collections__shade" aria-hidden="true" />
                <span className="home-collections__label">
                  <span>Explore collection</span>
                  <strong>{category}</strong>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section
        className="home-featured home-page__container"
        aria-labelledby="home-featured-title"
      >
        <header className="home-page__section-heading home-page__section-heading--row">
          <div>
            <p>Discover our catalogue</p>
            <h2 id="home-featured-title">Featured Frames</h2>
          </div>
          <Link className="home-page__text-link" to="/products">
            View All <span aria-hidden="true">→</span>
          </Link>
        </header>

        {loading ? (
          <p className="home-featured__state" role="status">
            Loading featured products...
          </p>
        ) : null}

        {!loading && error ? (
          <div className="home-featured__state" role="alert">
            <p>We could not load featured products. Please try again later.</p>
            <button
              className="home-page__button home-page__button--navy"
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <p className="home-featured__state">
            No products available right now. You can still browse our
            collections.
          </p>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <div className="home-featured__grid">
            {products.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        ) : null}
      </section>

      <section
        className="home-promos home-page__container"
        aria-labelledby="home-promos-title"
      >
        <h2 id="home-promos-title" className="home-page__sr-only">
          Explore more
        </h2>
        <div className="home-promos__feature">
          <img src={promoImage} alt="Woman wearing sunglasses" loading="lazy" />
          <div className="home-promos__feature-shade" aria-hidden="true" />
          <div className="home-promos__feature-copy">
            <p>Explore more</p>
            <h3>Discover Sunglasses</h3>
            <span>Browse our sunglasses collection.</span>
            <Link
              className="home-page__button home-page__button--light"
              to="/products?category=Sunglasses"
            >
              Browse Sunglasses <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="home-promos__side">
          <article className="home-promos__tile home-promos__tile--gold">
            <p>Our services</p>
            <h3>Eye Tests</h3>
            <span>Explore eye-care services at Darshana Opticals.</span>
          </article>
          <article className="home-promos__tile home-promos__tile--navy">
            <p>Find your frame</p>
            <h3>Explore Styles</h3>
            <Link to="/products">
              Shop Collections <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
