import { Link } from 'react-router-dom';
import useCart from '../hooks/useCart';
import { formatCurrency } from '../utils/formatCurrency';
import './CartPage.css';

function CartPage() {
  const {
    items,
    cartTotal,
    hasUnavailableItems,
    isLoading,
    isMutating,
    error,
    updateItemQuantity,
    removeItem,
    refreshCart,
    clearError,
  } = useCart();

  if (isLoading) {
    return (
      <section className="cart-page">
        <div className="cart-page__status" role="status">
          Loading your cart...
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="cart-page">
        <div className="cart-page__empty">
          <p className="cart-page__eyebrow">Your shopping cart</p>

          <h1>Your cart is empty</h1>

          <p>
            Browse our eyewear collection and add products when you are ready.
          </p>

          {error ? (
            <>
              <p className="cart-page__error" role="alert">
                {error}
              </p>

              <button
                type="button"
                className="cart-page__retry"
                onClick={refreshCart}
              >
                Retry
              </button>
            </>
          ) : null}

          <Link className="cart-page__browse-link" to="/products">
            Browse Products
          </Link>
        </div>
      </section>
    );
  }

  async function handleDecrease(item) {
    clearError();

    if (item.quantity <= 1) {
      return;
    }

    await updateItemQuantity(item.inventoryId, item.quantity - 1);
  }

  async function handleIncrease(item) {
    clearError();

    await updateItemQuantity(item.inventoryId, item.quantity + 1);
  }

  async function handleRemove(item) {
    clearError();

    await removeItem(item.inventoryId);
  }

  return (
    <section className="cart-page">
      <header className="cart-page__header">
        <div>
          <p className="cart-page__eyebrow">Your shopping cart</p>

          <h1>Review your items</h1>

          <p>
            Prices shown here are estimates. Final price and stock are verified
            during checkout.
          </p>
        </div>
      </header>

      {error ? (
        <p className="cart-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {hasUnavailableItems ? (
        <p className="cart-page__warning" role="status">
          Some product details are currently unavailable. Please review your
          cart again before checkout.
        </p>
      ) : null}

      <div className="cart-page__layout">
        <div className="cart-page__items">
          {items.map((item) => {
            const product = item.product;
            const price = Number(product?.price);
            const hasPrice = Number.isFinite(price);
            const lineSubtotal = hasPrice ? price * item.quantity : null;

            return (
              <article className="cart-item" key={item.inventoryId}>
                <div className="cart-item__info">
                  <p className="cart-item__brand">
                    {product?.brand || 'Product details unavailable'}
                  </p>

                  <h2>{product?.name || `Item ${item.inventoryId}`}</h2>

                  <p className="cart-item__id">Item ID: {item.inventoryId}</p>

                  <p className="cart-item__price">
                    {hasPrice
                      ? `${formatCurrency(price)} each`
                      : 'Current price unavailable'}
                  </p>
                </div>

                <div
                  className="cart-item__quantity"
                  aria-label={`Quantity controls for ${
                    product?.name || item.inventoryId
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleDecrease(item)}
                    disabled={isMutating || item.quantity <= 1}
                    aria-label={`Decrease quantity for ${
                      product?.name || item.inventoryId
                    }`}
                  >
                    −
                  </button>

                  <span aria-live="polite">{item.quantity}</span>

                  <button
                    type="button"
                    onClick={() => handleIncrease(item)}
                    disabled={isMutating}
                    aria-label={`Increase quantity for ${
                      product?.name || item.inventoryId
                    }`}
                  >
                    +
                  </button>
                </div>

                <div className="cart-item__subtotal">
                  <span>Subtotal</span>

                  <strong>
                    {lineSubtotal === null
                      ? 'Unavailable'
                      : formatCurrency(lineSubtotal)}
                  </strong>
                </div>

                <button
                  type="button"
                  className="cart-item__remove"
                  onClick={() => handleRemove(item)}
                  disabled={isMutating}
                  aria-label={`Remove ${
                    product?.name || item.inventoryId
                  } from cart`}
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary" aria-label="Cart summary">
          <h2>Order summary</h2>

          <div className="cart-summary__row">
            <span>Estimated total</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>

          <p className="cart-summary__note">
            Final prices and stock availability will be validated by the server
            during checkout.
          </p>

          <Link
            className={`cart-summary__checkout ${
              hasUnavailableItems ? 'cart-summary__checkout--disabled' : ''
            }`}
            to={hasUnavailableItems ? '/cart' : '/checkout'}
            aria-disabled={hasUnavailableItems}
            onClick={(event) => {
              if (hasUnavailableItems) {
                event.preventDefault();
              }
            }}
          >
            Proceed to Checkout
          </Link>

          <Link className="cart-summary__continue" to="/products">
            Continue shopping
          </Link>
        </aside>
      </div>
    </section>
  );
}

export default CartPage;
