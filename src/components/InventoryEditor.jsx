import { useState } from 'react';

function InventoryEditor({ mode, item, onCancel, onSave, saving, error }) {
  const creating = mode === 'create';
  const priceOnly = mode === 'price';
  const [values, setValues] = useState({
    itemName: item?.itemName ?? '',
    category: item?.category ?? '',
    brand: item?.brand ?? '',
    price: item?.price == null ? '' : String(item.price),
    quantity: creating ? '0' : '',
  });
  const [validationError, setValidationError] = useState('');

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setValidationError('');
  }

  function submit(event) {
    event.preventDefault();
    if (saving) return;

    const price = Number(values.price);
    if (!values.price.trim() || !Number.isFinite(price) || price < 0) {
      setValidationError('Enter a valid non-negative price.');
      return;
    }

    if (priceOnly) {
      onSave({ price });
      return;
    }

    const itemName = values.itemName.trim();
    const category = values.category.trim();
    const brand = values.brand.trim();
    if (!itemName || !category || !brand) {
      setValidationError('Item name, category and brand are required.');
      return;
    }

    const payload = { itemName, category, brand, price };
    if (creating) {
      const quantity = Number(values.quantity);
      if (
        !values.quantity.trim() ||
        !Number.isInteger(quantity) ||
        quantity < 0
      ) {
        setValidationError('Enter a valid non-negative whole-number quantity.');
        return;
      }
      payload.quantity = quantity;
    }

    onSave(payload);
  }

  return (
    <section
      className="inventory-page__editor"
      aria-label="Inventory item form"
    >
      <h2>
        {creating
          ? 'Add Inventory Item'
          : priceOnly
            ? 'Edit Item Price'
            : 'Edit Inventory Item'}
      </h2>
      <form onSubmit={submit} noValidate>
        {!priceOnly && (
          <>
            <label>
              Item Name
              <input
                name="itemName"
                value={values.itemName}
                onChange={change}
                required
                disabled={saving}
              />
            </label>
            <label>
              Category
              <input
                name="category"
                value={values.category}
                onChange={change}
                required
                disabled={saving}
              />
            </label>
            <label>
              Brand
              <input
                name="brand"
                value={values.brand}
                onChange={change}
                required
                disabled={saving}
              />
            </label>
          </>
        )}
        <label>
          Price (LKR)
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={values.price}
            onChange={change}
            required
            disabled={saving}
          />
        </label>
        {creating && (
          <label>
            Initial Quantity
            <input
              name="quantity"
              type="number"
              min="0"
              step="1"
              value={values.quantity}
              onChange={change}
              required
              disabled={saving}
            />
          </label>
        )}
        {validationError && <p role="alert">{validationError}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="inventory-page__editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : creating ? 'Add Item' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InventoryEditor;
