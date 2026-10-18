import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../src/pages/InventoryPage';
import {
  getBranchInventory,
  uploadInventoryImage,
  replaceInventoryImage,
  removeInventoryImage,
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
  replaceInventoryImage: vi.fn(),
  removeInventoryImage: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  updateInventoryQuantity: vi.fn(),
  overrideInventoryPrice: vi.fn(),
  getActiveReorderAlerts: vi
    .fn()
    .mockResolvedValue({ alerts: [], total: 0, page: 1, limit: 20 }),
  getGlobalReorderThreshold: vi.fn().mockResolvedValue(5),
  updateGlobalReorderThreshold: vi.fn(),
}));

const item = {
  _id: 'item-1',
  itemName: 'Blue Frame',
  category: 'Men',
  brand: 'Nova',
  price: 100,
  quantity: 5,
  imageUrl: 'https://res.cloudinary.com/test/image/upload/old.png',
  imagePublicId: 'osms/inventory/old',
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { role: 'BRANCH_MANAGER', branchId: 'branch-1' };
  getBranchInventory.mockResolvedValue([item]);
});

describe('inventory image management', () => {
  it('shows manager-only image action and preserves the current image until backend confirms replacement', async () => {
    const user = userEvent.setup();
    const file = new File(['image'], 'new.png', { type: 'image/png' });
    const metadata = {
      imageUrl: 'https://res.cloudinary.com/test/image/upload/new.png',
      imagePublicId: 'osms/inventory/new',
    };
    let finishReplace;
    uploadInventoryImage.mockResolvedValue(metadata);
    replaceInventoryImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReplace = resolve;
        }),
    );
    render(<InventoryPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Manage image for Blue Frame',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Select new image (JPG, PNG or WebP, max 5 MB)'),
      { target: { files: [file] } },
    );
    await user.click(screen.getByRole('button', { name: 'Replace Image' }));
    await waitFor(() =>
      expect(replaceInventoryImage).toHaveBeenCalledWith('item-1', metadata),
    );
    expect(uploadInventoryImage).toHaveBeenCalledWith(file);
    expect(
      screen.getByRole('img', { name: 'Current inventory image' }),
    ).toHaveAttribute('src', item.imageUrl);
    expect(
      screen.queryByText('Inventory image updated.'),
    ).not.toBeInTheDocument();
    finishReplace({ ...item, ...metadata });
    expect(
      await screen.findByText('Inventory image updated.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getBranchInventory).toHaveBeenCalledTimes(2));
  });

  it('requires confirmation before removing and refreshes only after the backend confirms', async () => {
    const user = userEvent.setup();
    removeInventoryImage.mockResolvedValueOnce({
      ...item,
      imageUrl: null,
      imagePublicId: null,
    });
    render(<InventoryPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Manage image for Blue Frame',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Remove Image' }));
    expect(removeInventoryImage).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm Remove' }));
    await waitFor(() =>
      expect(removeInventoryImage).toHaveBeenCalledWith('item-1'),
    );
    expect(
      await screen.findByText('Inventory image removed.'),
    ).toBeInTheDocument();
  });

  it('keeps current image and shows safe feedback when replacement fails', async () => {
    const user = userEvent.setup();
    uploadInventoryImage.mockRejectedValueOnce(
      Object.assign(new Error('Secret provider response'), { status: 502 }),
    );
    render(<InventoryPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Manage image for Blue Frame',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Select new image (JPG, PNG or WebP, max 5 MB)'),
      {
        target: {
          files: [new File(['image'], 'new.png', { type: 'image/png' })],
        },
      },
    );
    await user.click(screen.getByRole('button', { name: 'Replace Image' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to upload inventory image',
    );
    expect(replaceInventoryImage).not.toHaveBeenCalled();
    expect(
      screen.getByRole('img', { name: 'Current inventory image' }),
    ).toHaveAttribute('src', item.imageUrl);
    expect(
      screen.queryByText('Secret provider response'),
    ).not.toBeInTheDocument();
  });

  it('does not replace the visible image when attachment fails after upload', async () => {
    const user = userEvent.setup();
    uploadInventoryImage.mockResolvedValueOnce({
      imageUrl: 'https://res.cloudinary.com/test/image/upload/new.png',
      imagePublicId: 'osms/inventory/new',
    });
    replaceInventoryImage.mockRejectedValueOnce(
      Object.assign(new Error('internal provider details'), { status: 422 }),
    );
    render(<InventoryPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Manage image for Blue Frame',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Select new image (JPG, PNG or WebP, max 5 MB)'),
      {
        target: {
          files: [new File(['image'], 'new.png', { type: 'image/png' })],
        },
      },
    );
    await user.click(screen.getByRole('button', { name: 'Replace Image' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check the item information',
    );
    expect(
      screen.getByRole('img', { name: 'Current inventory image' }),
    ).toHaveAttribute('src', item.imageUrl);
    expect(
      screen.queryByText('Inventory image updated.'),
    ).not.toBeInTheDocument();
    expect(getBranchInventory).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('internal provider details'),
    ).not.toBeInTheDocument();
  });

  it('rejects invalid replacements without uploading', async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Manage image for Blue Frame',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Select new image (JPG, PNG or WebP, max 5 MB)'),
      {
        target: {
          files: [new File(['wrong'], 'test.pdf', { type: 'application/pdf' })],
        },
      },
    );
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG or WebP');
    expect(
      screen.getByRole('button', { name: 'Replace Image' }),
    ).toBeDisabled();
    expect(uploadInventoryImage).not.toHaveBeenCalled();
  });

  it('does not expose image operations to System Admin', async () => {
    auth.user = { role: 'SYSTEM_ADMIN' };
    render(<InventoryPage />);
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Branch' }),
        'branch-1',
      );
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage image for Blue Frame' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Select new image (JPG, PNG or WebP, max 5 MB)'),
    ).not.toBeInTheDocument();
  });
});
