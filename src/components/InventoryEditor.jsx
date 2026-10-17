import { useEffect, useState } from 'react';
import './InventoryImageUpload.css';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function InventoryEditor({
  mode,
  item,
  onCancel,
  onSave,
  saving,
  uploading = false,
  error,
}) {
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
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!imageFile || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    setPreviewFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function selectImage(event) {
    const file = event.target.files?.[0] ?? null;
    setValidationError('');
    setImageError('');
    setImageFile(null);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Image must be 5 MB or smaller.');
      return;
    }
    setImageFile(file);
  }

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
      if (imageFile) payload.imageFile = imageFile;
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
        {creating && (
          <div className="inventory-page__image-upload">
            <label htmlFor="inventory-create-image">
              Inventory Image (optional)
            </label>
            <input
              id="inventory-create-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={selectImage}
              disabled={saving}
              aria-describedby="inventory-image-help"
            />
            <small id="inventory-image-help">
              JPG, PNG or WebP — maximum 5 MB.
            </small>
            {imageFile && <small>Selected image: {imageFile.name}</small>}
            {previewUrl && !previewFailed && (
              <img
                className="inventory-page__selected-image"
                src={previewUrl}
                alt="Selected inventory image preview"
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
        )}
        {imageError && <p role="alert">{imageError}</p>}
        {validationError && <p role="alert">{validationError}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="inventory-page__editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {uploading
              ? 'Uploading image...'
              : saving
                ? 'Saving...'
                : creating
                  ? 'Add Item'
                  : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InventoryEditor;
