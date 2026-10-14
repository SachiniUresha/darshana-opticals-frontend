import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import { submitCheckout } from '../services/checkoutService';
import { formatCurrency } from '../utils/formatCurrency';
import './CheckoutEntryPage.css';

function statusLabel(status) {
  if (typeof status !== 'string' || !status.trim()) {
    return 'Status unavailable';
  }

  return status.replace(/_/g, ' ');
}

function dateTimeLabel(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Colombo',
  });
}

function checkoutErrorMessage(error) {
  switch (error?.code) {
    case 'INSUFFICIENT_STOCK':
      return 'Some items no longer have enough stock. Please return to your cart and adjust the quantities.';

    case 'CART_NOT_FOUND':
      return 'Your cart is empty or no longer available. Please return to your cart and review it.';

    case 'INVENTORY_NOT_FOUND':
      return 'One or more products in your cart are no longer available. Please return to your cart and review the items.';

    case 'INVALID_CHECKOUT_CART':
      return 'Your cart contains an item that cannot be checked out. Please return to your cart and review it.';

    case 'CHECKOUT_CONFLICT':
      return 'Your cart changed while the order was being placed. Please return to your cart and review it before trying again.';

    default:
      break;
  }

  if (error?.status === 422 || error?.status === 400) {
    return 'The order could not be validated. Please review your cart and try again.';
  }

  if (error?.status === 403) {
    return 'Your account does not have permission to place this order.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not place your order. Your cart has been preserved. Please try again.';
}

function CheckoutEntryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items, cartTotal, hasUnavailableItems, isLoading, refreshCart } =
    useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const customerId = user?.id || '';
  const activeCustomerRef = useRef(customerId);

  activeCustomerRef.current = customerId;

  useEffect(() => {
    setIsSubmitting(false);
    setCheckoutError('');
    setConfirmation(null);
  }, [customerId]);

  async function handleCheckout() {
    if (isSubmitting || items.length === 0 || hasUnavailableItems) {
      return;
    }

    const submittingCustomerId = activeCustomerRef.current;

    setIsSubmitting(true);
    setCheckoutError('');

    try {
      const result = await submitCheckout();

      if (activeCustomerRef.current !== submittingCustomerId) {
        return;
      }

      setConfirmation(result);

      /*
       * The backend deletes the persisted cart only after successful order
       * creation. Refreshing here synchronizes the frontend cart with that
       * confirmed backend state.
       */
      await refreshCart();
    } catch (error) {
      if (activeCustomerRef.current !== submittingCustomerId) {
        return;
      }

      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      setCheckoutError(checkoutErrorMessage(error));
    } finally {
      if (activeCustomerRef.current === submittingCustomerId) {
        setIsSubmitting(false);
      }
    }
  }

  if (confirmation) {
    const { order, items: confirmedItems } = confirmation;

    return (
      <section className="checkout-page">
        <div className="checkout-confirmation" role="status" aria-live="polite">
          <div className="checkout-confirmation__icon" aria-hidden="true">
            ✓
          </div>

          <h1>Order Confirmed!</h1>

          <p className="checkout-confirmation__intro">
            Thank you for your purchase. Your order has been created
            successfully.
          </p>

          <div
            className="checkout-confirmation__details"
            aria-label="Confirmed order details"
          >
            <div>
              <span>Order ID</span>
              <strong>{order.id}</strong>
            </div>

            <div>
              <span>Order date</span>
              <strong>{dateTimeLabel(order.orderDate)}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{statusLabel(order.status)}</strong>
            </div>
          </div>

          <div className="checkout-confirmation__items">
            <h2>Confirmed items</h2>

            <ul>
              {confirmedItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.itemName}</strong>
                    <span>Quantity: {item.quantity}</span>
                  </div>

                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="checkout-confirmation__total">
            <span>Confirmed total</span>
            <strong>{formatCurrency(order.orderAmount)}</strong>
          </div>

          <div className="checkout-confirmation__actions">
            <Link to="/orders" className="checkout-confirmation__secondary">
              View My Orders
            </Link>

            <Link to="/" className="checkout-confirmation__primary">
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="checkout-page">
        <div className="checkout-status" role="status">
          Loading checkout...
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="checkout-page">
        <div className="checkout-empty">
          <h1>Your cart is empty</h1>

          <p>Add products to your cart before continuing to checkout.</p>

          <Link to="/products" className="checkout-empty__button">
            Browse Products
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="checkout-page">
      <div className="checkout-layout">
        <article className="checkout-review" aria-labelledby="checkout-title">
          <header className="checkout-review__header">
            <h1 id="checkout-title">Review Your Order</h1>

            <p>
              Final prices and stock availability will be verified securely when
              you place the order.
            </p>
          </header>

          {checkoutError ? (
            <div className="checkout-error" role="alert">
              {checkoutError}
            </div>
          ) : null}

          {hasUnavailableItems ? (
            <div className="checkout-warning" role="alert">
              Some product information is currently unavailable. Please return
              to your cart and review the items before checkout.
            </div>
          ) : null}

          <div className="checkout-review__table">
            <div className="checkout-review__table-header" aria-hidden="true">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Subtotal</span>
            </div>

            <ul className="checkout-review__items">
              {items.map((item) => {
                const product = item.product;
                const price = Number(product?.price);
                const hasPrice = Number.isFinite(price);
                const subtotal = hasPrice ? price * item.quantity : null;

                return (
                  <li key={item.inventoryId}>
                    <div className="checkout-review__product">
                      <strong>
                        {product?.name || 'Product details unavailable'}
                      </strong>

                      <span>
                        {product?.brand || `Item ${item.inventoryId}`}
                      </span>
                    </div>

                    <span
                      className="checkout-review__quantity"
                      data-label="Quantity"
                    >
                      {item.quantity}
                    </span>

                    <span data-label="Unit price">
                      {hasPrice ? formatCurrency(price) : 'Unavailable'}
                    </span>

                    <strong data-label="Subtotal">
                      {subtotal === null
                        ? 'Unavailable'
                        : formatCurrency(subtotal)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="checkout-review__notice">
            <strong>Before you place the order</strong>
            <p>
              The values shown on this page are provisional. The backend will
              validate current prices and stock before creating your order.
            </p>
          </div>

          <div className="checkout-review__actions">
            <Link to="/cart" className="checkout-back">
              ← Back to Cart
            </Link>

            <button
              type="button"
              className="checkout-place-order"
              onClick={handleCheckout}
              disabled={
                isSubmitting || hasUnavailableItems || items.length === 0
              }
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
              {!isSubmitting ? <span aria-hidden="true">›</span> : null}
            </button>
          </div>
        </article>

        <aside
          className="checkout-summary"
          aria-labelledby="checkout-summary-title"
        >
          <h2 id="checkout-summary-title">Order Summary</h2>

          <ul className="checkout-summary__items">
            {items.map((item) => {
              const price = Number(item.product?.price);
              const subtotal = Number.isFinite(price)
                ? price * item.quantity
                : null;

              return (
                <li key={item.inventoryId}>
                  <span>
                    {item.product?.name || 'Unavailable item'} × {item.quantity}
                  </span>

                  <strong>
                    {subtotal === null
                      ? 'Unavailable'
                      : formatCurrency(subtotal)}
                  </strong>
                </li>
              );
            })}
          </ul>

          <div className="checkout-summary__divider" />

          <div className="checkout-summary__total">
            <span>Estimated Total</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>

          <p className="checkout-summary__note">
            The confirmed total may change if the backend detects an updated
            product price.
          </p>
        </aside>
      </div>
    </section>
  );
}

export default CheckoutEntryPage;
