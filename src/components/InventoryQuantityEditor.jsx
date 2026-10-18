import { useState } from 'react';
import './InventoryQuantityEditor.css';

function InventoryQuantityEditor({ item, saving, error, onCancel, onSave }) {
  const [quantity, setQuantity] = useState(
    typeof item?.quantity === 'number' ? String(item.quantity) : '',
  );
  const [validationError, setValidationError] = useState('');

  function submit(event) {
    event.preventDefault();
    if (saving) return;

    const value = quantity.trim();
    const number = Number(value);
    if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(number)) {
      setValidationError('Enter a valid non-negative whole-number quantity.');
      return;
    }

    onSave({ quantity: number });
  }

  return (
    <section
      className="inventory-page__editor"
      aria-label="Update inventory quantity"
    >
      <h2>Update Stock Quantity</h2>
      <p>Set the total stock units for {item?.itemName || 'this item'}.</p>
      <form onSubmit={submit} noValidate>
        <label>
          New Quantity
          <input
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setValidationError('');
            }}
            disabled={saving}
            required
          />
        </label>
        {validationError && <p role="alert">{validationError}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="inventory-page__editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Quantity'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InventoryQuantityEditor;
