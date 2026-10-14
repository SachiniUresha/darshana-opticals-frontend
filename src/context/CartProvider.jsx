import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CUSTOMER } from '../config/roles';
import useAuth from '../hooks/useAuth';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../services/cartService';
import { getProductById } from '../services/productService';
import CartContext from './CartContext';

const CART_LOAD_ERROR = "We couldn't load your cart. Please try again.";
const CART_UPDATE_ERROR = "We couldn't update your cart. Please try again.";
const INVALID_QUANTITY_ERROR = 'Quantity must be a positive whole number.';
const CART_ACCESS_ERROR =
  'Cart functionality is available only to authenticated customer accounts.';

function isValidQuantity(quantity) {
  return Number.isSafeInteger(quantity) && quantity > 0;
}

async function hydrateCartItems(cart) {
  return Promise.all(
    cart.items.map(async (item) => {
      try {
        const product = await getProductById(item.inventoryId);

        return {
          ...item,
          product,
        };
      } catch {
        return {
          ...item,
          product: null,
        };
      }
    }),
  );
}

function CartProvider({ children }) {
  const { isAuthenticated, user } = useAuth();

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');

  const canUseCart = isAuthenticated && user?.role === CUSTOMER;
  const customerId = user?.id || '';

  /*
   * Each authentication/customer transition creates a new cart-session
   * version. Async work remembers the version it started with and ignores
   * its result if the active session has changed before it completes.
   *
   * This prevents a late response belonging to Customer A from overwriting
   * Customer B's cart after logout/login or an account switch.
   */
  const cartIdentity = `${isAuthenticated ? 'authenticated' : 'anonymous'}:${
    user?.role || ''
  }:${customerId}`;

  const cartSessionRef = useRef({
    identity: cartIdentity,
    version: 0,
  });

  if (cartSessionRef.current.identity !== cartIdentity) {
    cartSessionRef.current = {
      identity: cartIdentity,
      version: cartSessionRef.current.version + 1,
    };
  }

  const isCurrentCartSession = useCallback(
    (version) => cartSessionRef.current.version === version,
    [],
  );

  useEffect(() => {
    let active = true;

    if (!canUseCart) {
      setItems([]);
      setIsLoading(false);
      setIsMutating(false);
      setError('');

      return () => {
        active = false;
      };
    }

    // Do not leave a previous customer's cart visible while the new cart loads.
    setItems([]);
    setIsMutating(false);

    async function loadCustomerCart() {
      setIsLoading(true);
      setError('');

      try {
        const cart = await getCart();
        const hydratedItems = await hydrateCartItems(cart);

        if (active) {
          setItems(hydratedItems);
        }
      } catch {
        if (active) {
          setItems([]);
          setError(CART_LOAD_ERROR);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadCustomerCart();

    return () => {
      active = false;
    };
  }, [canUseCart, customerId]);

  const refreshCart = useCallback(async () => {
    if (!canUseCart) {
      setError(CART_ACCESS_ERROR);
      return false;
    }

    const requestSession = cartSessionRef.current.version;

    setIsLoading(true);
    setError('');

    try {
      const cart = await getCart();

      if (!isCurrentCartSession(requestSession)) {
        return false;
      }

      const hydratedItems = await hydrateCartItems(cart);

      if (!isCurrentCartSession(requestSession)) {
        return false;
      }

      setItems(hydratedItems);

      return true;
    } catch {
      if (!isCurrentCartSession(requestSession)) {
        return false;
      }

      setItems([]);
      setError(CART_LOAD_ERROR);

      return false;
    } finally {
      if (isCurrentCartSession(requestSession)) {
        setIsLoading(false);
      }
    }
  }, [canUseCart, isCurrentCartSession]);

  const runMutation = useCallback(
    async (operation) => {
      if (!canUseCart) {
        setError(CART_ACCESS_ERROR);
        return false;
      }

      const requestSession = cartSessionRef.current.version;

      setIsMutating(true);
      setError('');

      try {
        const cart = await operation();

        if (!isCurrentCartSession(requestSession)) {
          return false;
        }

        const hydratedItems = await hydrateCartItems(cart);

        if (!isCurrentCartSession(requestSession)) {
          return false;
        }

        setItems(hydratedItems);

        return true;
      } catch {
        if (!isCurrentCartSession(requestSession)) {
          return false;
        }

        setError(CART_UPDATE_ERROR);
        return false;
      } finally {
        if (isCurrentCartSession(requestSession)) {
          setIsMutating(false);
        }
      }
    },
    [canUseCart, isCurrentCartSession],
  );

  const addItem = useCallback(
    async (inventoryId, quantity = 1) => {
      if (!isValidQuantity(quantity)) {
        setError(INVALID_QUANTITY_ERROR);
        return false;
      }

      return runMutation(() => addCartItem(inventoryId, quantity));
    },
    [runMutation],
  );

  const updateItemQuantity = useCallback(
    async (inventoryId, quantity) => {
      if (!isValidQuantity(quantity)) {
        setError(INVALID_QUANTITY_ERROR);
        return false;
      }

      return runMutation(() => updateCartItemQuantity(inventoryId, quantity));
    },
    [runMutation],
  );

  const removeItem = useCallback(
    async (inventoryId) => runMutation(() => removeCartItem(inventoryId)),
    [runMutation],
  );

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const cartCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const cartTotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const price = Number(item.product?.price);

        if (!Number.isFinite(price)) {
          return total;
        }

        return total + price * item.quantity;
      }, 0),
    [items],
  );

  const hasUnavailableItems = useMemo(
    () => items.some((item) => !item.product),
    [items],
  );

  const value = {
    items,
    cartCount,
    cartTotal,
    hasUnavailableItems,
    isLoading,
    isMutating,
    error,
    canUseCart,
    addItem,
    updateItemQuantity,
    removeItem,
    refreshCart,
    clearError,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export default CartProvider;
