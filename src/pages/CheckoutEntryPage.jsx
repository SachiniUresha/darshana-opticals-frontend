import { Link } from 'react-router-dom';

function CheckoutEntryPage() {
  return (
    <section>
      <h1>Checkout</h1>

      <p>
        Your cart is ready for checkout. Final prices and stock availability
        will be verified before the order is created.
      </p>

      <p>
        Checkout processing will continue in the next checkout implementation
        step.
      </p>

      <Link to="/cart">Back to cart</Link>
    </section>
  );
}

export default CheckoutEntryPage;
