import { useEffect, useState } from 'react';
import './InventoryImageManager.css';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function InventoryImageManager({
  item,
  saving,
  uploading,
  error,
  onReplace,
  onRemove,
  onCancel,
}) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [currentFailed, setCurrentFailed] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const currentUrl = item?.imageUrl;
  const hasImage = Boolean(currentUrl || item?.imagePublicId);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewFailed(false);
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    };
  }, [file]);

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(null);
    setFileError('');
    setConfirmRemoval(false);
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type)) {
      setFileError('Choose a JPG, PNG or WebP image.');
    } else if (selected.size > MAX_BYTES) {
      setFileError('Image must be 5 MB or smaller.');
    } else {
      setFile(selected);
    }
  }

  return (
    <section
      className="inventory-page__editor"
      aria-label="Manage inventory image"
    >
      <h2>Manage Image — {item?.itemName || 'Inventory item'}</h2>
      <div className="inventory-image-manager">
        <div className="inventory-image-manager__previews">
          <div>
            <strong>Current image</strong>
            {typeof currentUrl === 'string' &&
            currentUrl.startsWith('https://') &&
            !currentFailed ? (
              <img
                src={currentUrl}
                alt="Current inventory image"
                onError={() => setCurrentFailed(true)}
              />
            ) : (
              <p>No current image</p>
            )}
          </div>
          {file && (
            <div>
              <strong>New image preview</strong>
              {previewUrl && !previewFailed ? (
                <img
                  src={previewUrl}
                  alt="Replacement image preview"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <p>{file.name}</p>
              )}
            </div>
          )}
        </div>
        <label htmlFor="inventory-replacement-image">
          Select new image (JPG, PNG or WebP, max 5 MB)
        </label>
        <input
          id="inventory-replacement-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={selectFile}
          disabled={saving}
        />
        {fileError && <p role="alert">{fileError}</p>}
        {error && <p role="alert">{error}</p>}
        {confirmRemoval && (
          <div className="inventory-image-manager__confirm">
            <p>Remove the current inventory image?</p>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmRemoval(false)}
            >
              Keep Image
            </button>
            <button type="button" disabled={saving} onClick={onRemove}>
              Confirm Remove
            </button>
          </div>
        )}
        <div className="inventory-page__editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          {hasImage && !confirmRemoval && (
            <button
              type="button"
              onClick={() => setConfirmRemoval(true)}
              disabled={saving}
            >
              Remove Image
            </button>
          )}
          <button
            type="button"
            onClick={() => onReplace(file)}
            disabled={saving || !file}
          >
            {uploading
              ? 'Uploading image...'
              : saving
                ? 'Saving...'
                : hasImage
                  ? 'Replace Image'
                  : 'Add Image'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default InventoryImageManager;
