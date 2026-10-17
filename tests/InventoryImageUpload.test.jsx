import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryEditor from '../src/components/InventoryEditor';
import InventoryPage from '../src/pages/InventoryPage';
import {
  getBranchInventory,
  uploadInventoryImage,
  createInventoryItem,
} from '../src/services/inventoryService';

const auth = vi.hoisted(() => ({
  user: { role: 'BRANCH_MANAGER', branchId: 'branch-1' },
}));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ user: auth.user }),
}));
vi.mock('../src/hooks/useBranches', () => ({
  useBranches: () => ({
    branches: [{ id: 'branch-1', address: 'Kandy Road' }],
    loading: false,
    error: null,
    unauthorized: false,
    retry: vi.fn(),
  }),
}));
vi.mock('../src/services/inventoryService', () => ({
  getBranchInventory: vi.fn(),
  uploadInventoryImage: vi.fn(),
  createInventoryItem: vi.fn(),
  getActiveReorderAlerts: vi
    .fn()
    .mockResolvedValue({ alerts: [], total: 0, page: 1, limit: 20 }),
  getGlobalReorderThreshold: vi.fn().mockResolvedValue(5),
  updateGlobalReorderThreshold: vi.fn(),
  updateInventoryItem: vi.fn(),
  overrideInventoryPrice: vi.fn(),
  updateInventoryQuantity: vi.fn(),
}));

let oldCreateObjectURL;
let oldRevokeObjectURL;
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { role: 'BRANCH_MANAGER', branchId: 'branch-1' };
  getBranchInventory.mockResolvedValue([]);
  oldCreateObjectURL = URL.createObjectURL;
  oldRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:image-preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  URL.createObjectURL = oldCreateObjectURL;
  URL.revokeObjectURL = oldRevokeObjectURL;
});

async function fillCreationForm(user) {
  await user.click(screen.getByRole('button', { name: 'Add Inventory Item' }));
  await user.type(screen.getByRole('textbox', { name: 'Item Name' }), 'Frame');
  await user.type(screen.getByRole('textbox', { name: 'Category' }), 'Men');
  await user.type(screen.getByRole('textbox', { name: 'Brand' }), 'Nova');
  await user.type(
    screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
    '1200',
  );
  const quantity = screen.getByRole('spinbutton', { name: 'Initial Quantity' });
  await user.clear(quantity);
  await user.type(quantity, '2');
}

describe('inventory image upload UI', () => {
  it('shows a preview and passes selected image to create form without treating preview as persisted', async () => {
    const onSave = vi.fn();
    const file = new File(['image'], 'frame.jpg', { type: 'image/jpeg' });
    render(
      <InventoryEditor
        mode="create"
        onCancel={vi.fn()}
        onSave={onSave}
        saving={false}
      />,
    );
    fireEvent.change(screen.getByLabelText('Inventory Image (optional)'), {
      target: { files: [file] },
    });
    expect(
      await screen.findByRole('img', {
        name: 'Selected inventory image preview',
      }),
    ).toHaveAttribute('src', 'blob:image-preview');
    expect(screen.getByText('Selected image: frame.jpg')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects unsupported files and images above 5 MB before submitting', async () => {
    const onSave = vi.fn();
    render(
      <InventoryEditor
        mode="create"
        onCancel={vi.fn()}
        onSave={onSave}
        saving={false}
      />,
    );
    const input = screen.getByLabelText('Inventory Image (optional)');
    fireEvent.change(input, {
      target: {
        files: [new File(['pdf'], 'file.pdf', { type: 'application/pdf' })],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG or WebP');
    const largeFile = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'large.png',
      { type: 'image/png' },
    );
    fireEvent.change(input, { target: { files: [largeFile] } });
    expect(screen.getByRole('alert')).toHaveTextContent('5 MB');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('hides image upload controls for System Admin price-only editing', () => {
    render(
      <InventoryEditor
        mode="price"
        item={{ price: 50 }}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );
    expect(
      screen.queryByLabelText('Inventory Image (optional)'),
    ).not.toBeInTheDocument();
  });

  it('uploads first, then creates inventory with backend-returned image metadata', async () => {
    const user = userEvent.setup();
    const file = new File(['image'], 'frame.webp', { type: 'image/webp' });
    const metadata = {
      imageUrl: 'https://res.cloudinary.com/test/image/upload/a.webp',
      imagePublicId: 'osms/inventory/a',
    };
    const calls = [];
    uploadInventoryImage.mockImplementationOnce(async () => {
      calls.push('upload');
      return metadata;
    });
    createInventoryItem.mockImplementationOnce(async () => {
      calls.push('create');
      return { _id: 'new' };
    });
    render(<InventoryPage />);
    await screen.findByText('No inventory items found for this branch.');
    await fillCreationForm(user);
    fireEvent.change(screen.getByLabelText('Inventory Image (optional)'), {
      target: { files: [file] },
    });
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await waitFor(() => expect(createInventoryItem).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(['upload', 'create']);
    expect(uploadInventoryImage).toHaveBeenCalledWith(file);
    expect(createInventoryItem).toHaveBeenCalledWith(
      'branch-1',
      expect.objectContaining({ itemName: 'Frame' }),
      metadata,
    );
    expect(
      await screen.findByText('Inventory item added.'),
    ).toBeInTheDocument();
  });

  it('does not create inventory or claim success when image upload fails', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('provider secret'), { status: 502 });
    uploadInventoryImage.mockRejectedValueOnce(error);
    render(<InventoryPage />);
    await screen.findByText('No inventory items found for this branch.');
    await fillCreationForm(user);
    fireEvent.change(screen.getByLabelText('Inventory Image (optional)'), {
      target: { files: [new File(['image'], 'x.png', { type: 'image/png' })] },
    });
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to upload inventory image',
    );
    expect(createInventoryItem).not.toHaveBeenCalled();
    expect(screen.queryByText('provider secret')).not.toBeInTheDocument();
  });
});
