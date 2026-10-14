import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CUSTOMER } from '../../config/roles';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import './AddToCartButton.css';

function AddToCartButton({ product }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { addItem, isLoading, isMutating } = useCart();

  const isBusy = isLoading || isMutating;

  const [message, setMessage] = useState('');

  if (isAuthenticated && user?.role !== CUSTOMER) {
    return null;
  }

  async function handleAddToCart() {
    setMessage('');

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const added = await addItem(product.id, 1);

    if (added) {
      setMessage('Added to cart.');
    } else {
      setMessage('Unable to add this item. Please try again.');
    }
  }

  return (
    <div className="add-to-cart">
      <button
        type="button"
        className="add-to-cart__button"
        onClick={handleAddToCart}
        disabled={isBusy}
        aria-label={`Add ${product.name} to cart`}
      >
        {isBusy ? 'Adding...' : 'Add to Cart'}
      </button>

      {message ? (
        <p
          className="add-to-cart__message"
          role={message === 'Added to cart.' ? 'status' : 'alert'}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default AddToCartButton;
