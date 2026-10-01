import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageService } from '../ImageService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('ImageService', () => {
  let service: ImageService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockImageId = 'image-456';

  const mockImage = {
    id: mockImageId,
    store_id: mockStoreId,
    entity_type: 'product',
    entity_id: 'product-789',
    filename: 'pizza.jpg',
    url_original: 'https://cdn.example.com/pizza.jpg',
    url_thumbnail: 'https://cdn.example.com/pizza_thumb.jpg',
    file_size: 102400,
    mime_type: 'image/jpeg',
    dimensions: '800x600',
    active: true,
    uploaded_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImageService();
    mockQueries = {
      createImage: vi.fn(),
      findImageById: vi.fn(),
      findAllByStore: vi.fn(),
      findByEntity: vi.fn(),
      updateImage: vi.fn(),
      deleteImage: vi.fn(),
    };
  });

  describe('createImage', () => {
    it('should create image successfully', async () => {
      mockQueries.createImage.mockResolvedValue(mockImage);
      (service as any).queries = mockQueries;

      const result = await service.createImage(mockStoreId, {
        entity_type: 'product',
        entity_id: 'product-789',
        filename: 'pizza.jpg',
        url_original: 'https://cdn.example.com/pizza.jpg',
      });

      expect(result.filename).toBe('pizza.jpg');
      expect(result.entity_type).toBe('product');
      expect(result.store_id).toBe(mockStoreId);
      expect(mockQueries.createImage).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: mockStoreId, active: true })
      );
    });
  });

  describe('getImage', () => {
    it('should return image by id', async () => {
      mockQueries.findImageById.mockResolvedValue(mockImage);
      (service as any).queries = mockQueries;

      const result = await service.getImage(mockImageId, mockStoreId);

      expect(result.id).toBe(mockImageId);
      expect(result.filename).toBe('pizza.jpg');
    });

    it('should throw if image not found', async () => {
      mockQueries.findImageById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getImage(mockImageId, mockStoreId)).rejects.toThrow('Image not found');
    });
  });

  describe('listImages', () => {
    it('should list images with pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[mockImage], 1]);
      (service as any).queries = mockQueries;

      const result = await service.listImages(mockStoreId, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should calculate correct skip', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listImages(mockStoreId, { page: 2, limit: 10 });

      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, 10, 10);
    });
  });

  describe('listImagesByEntity', () => {
    it('should list images by entity type and id', async () => {
      mockQueries.findByEntity.mockResolvedValue([mockImage]);
      (service as any).queries = mockQueries;

      const result = await service.listImagesByEntity(mockStoreId, 'product', 'product-789');

      expect(result).toHaveLength(1);
      expect(result[0].entity_type).toBe('product');
      expect(mockQueries.findByEntity).toHaveBeenCalledWith(mockStoreId, 'product', 'product-789');
    });
  });

  describe('updateImage', () => {
    it('should update image successfully', async () => {
      const updated = { ...mockImage, active: false };
      mockQueries.findImageById.mockResolvedValue(mockImage);
      mockQueries.updateImage.mockResolvedValue(updated);
      (service as any).queries = mockQueries;

      const result = await service.updateImage(mockImageId, mockStoreId, { active: false });

      expect(result.active).toBe(false);
    });

    it('should throw if image not found on update', async () => {
      mockQueries.findImageById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.updateImage(mockImageId, mockStoreId, {})).rejects.toThrow('Image not found');
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockQueries.findImageById.mockResolvedValue(mockImage);
      mockQueries.deleteImage.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteImage(mockImageId, mockStoreId);

      expect(mockQueries.deleteImage).toHaveBeenCalledWith(mockImageId, mockStoreId);
    });

    it('should throw if image not found on delete', async () => {
      mockQueries.findImageById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteImage(mockImageId, mockStoreId)).rejects.toThrow('Image not found');
    });
  });
});
