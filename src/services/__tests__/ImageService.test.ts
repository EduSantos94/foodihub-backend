import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ImageService } from '../ImageService.js';
import { ImageType, ImageModel } from '../../database/models/ImageModel.js';
import { CreateImageRequest, UpdateImageRequest, ImageListQuery } from '../../types/index.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

interface MockImageQueries {
  createImage: Mock;
  findImageById: Mock;
  findAllImages: Mock;
  updateImage: Mock;
  deleteImage: Mock;
}

describe('ImageService', () => {
  let service: ImageService;
  let mockQueries: MockImageQueries;

  const mockImageModel: ImageModel = {
    id: 1,
    shop_id: 10,
    type: ImageType.PRODUCT,
    type_id: 100,
    filename: 'test.jpg',
    rl_original: 'https://storage.example.com/test.jpg',
    url_thumbnail: 'https://storage.example.com/test_thumb.jpg',
    file_size: 102400,
    mime_type: 'image/jpeg',
    dimensions: '800x600',
    uploaded_at: new Date('2025-01-01T00:00:00.000Z'),
    active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new ImageService();

    mockQueries = {
      createImage: vi.fn(),
      findImageById: vi.fn(),
      findAllImages: vi.fn(),
      updateImage: vi.fn(),
      deleteImage: vi.fn(),
    };

    Reflect.set(service, 'queries', mockQueries);
  });

  describe('createImage', () => {
    it('should create image successfully', async () => {
      const createData: CreateImageRequest = {
        shop_id: 10,
        type: 'product',
        type_id: 100,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
        url_thumbnail: 'https://storage.example.com/test_thumb.jpg',
        file_size: 102400,
        mime_type: 'image/jpeg',
        dimensions: '800x600',
        active: true,
      };

      mockQueries.createImage.mockResolvedValue(mockImageModel);

      const result = await service.createImage(createData);

      expect(result).toEqual({
        id: 1,
        shop_id: 10,
        type: ImageType.PRODUCT,
        type_id: 100,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
        url_thumbnail: 'https://storage.example.com/test_thumb.jpg',
        file_size: 102400,
        mime_type: 'image/jpeg',
        dimensions: '800x600',
        uploaded_at: mockImageModel.uploaded_at,
        active: true,
      });

      expect(mockQueries.createImage).toHaveBeenCalledWith({
        shop_id: 10,
        type: ImageType.PRODUCT,
        type_id: 100,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
        url_thumbnail: 'https://storage.example.com/test_thumb.jpg',
        file_size: 102400,
        mime_type: 'image/jpeg',
        dimensions: '800x600',
        active: true,
      });
    });

    it('should throw error if shop_id is missing', async () => {
      const invalidData = {
        type: 'product',
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      } as unknown as CreateImageRequest;

      await expect(service.createImage(invalidData)).rejects.toThrow('shop_id is required');
      expect(mockQueries.createImage).not.toHaveBeenCalled();
    });

    it('should throw error if type is missing', async () => {
      const invalidData = {
        shop_id: 10,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      } as unknown as CreateImageRequest;

      await expect(service.createImage(invalidData)).rejects.toThrow('type is required');
      expect(mockQueries.createImage).not.toHaveBeenCalled();
    });

    it('should throw error if type is invalid', async () => {
      const invalidData = {
        shop_id: 10,
        type: 'invalid_type',
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      } as unknown as CreateImageRequest;

      await expect(service.createImage(invalidData)).rejects.toThrow('Invalid image type: invalid_type');
      expect(mockQueries.createImage).not.toHaveBeenCalled();
    });

    it('should throw error if filename is missing', async () => {
      const invalidData = {
        shop_id: 10,
        type: 'product',
        rl_original: 'https://storage.example.com/test.jpg',
      } as unknown as CreateImageRequest;

      await expect(service.createImage(invalidData)).rejects.toThrow('filename is required');
      expect(mockQueries.createImage).not.toHaveBeenCalled();
    });

    it('should throw error if rl_original is missing', async () => {
      const invalidData = {
        shop_id: 10,
        type: 'product',
        filename: 'test.jpg',
      } as unknown as CreateImageRequest;

      await expect(service.createImage(invalidData)).rejects.toThrow('rl_original is required');
      expect(mockQueries.createImage).not.toHaveBeenCalled();
    });
  });

  describe('getImage', () => {
    it('should get image by id successfully', async () => {
      mockQueries.findImageById.mockResolvedValue(mockImageModel);

      const result = await service.getImage(1, 10);

      expect(result.id).toBe(1);
      expect(result.shop_id).toBe(10);
      expect(mockQueries.findImageById).toHaveBeenCalledWith(1, 10);
    });

    it('should throw error if image not found', async () => {
      mockQueries.findImageById.mockResolvedValue(null);

      await expect(service.getImage(999)).rejects.toThrow('Image not found');
      expect(mockQueries.findImageById).toHaveBeenCalledWith(999, undefined);
    });
  });

  describe('listImages', () => {
    it('should list images with default pagination', async () => {
      mockQueries.findAllImages.mockResolvedValue([[mockImageModel], 1]);

      const result = await service.listImages();

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        total_pages: 1,
      });
      expect(mockQueries.findAllImages).toHaveBeenCalledWith({
        shop_id: undefined,
        type: undefined,
        type_id: undefined,
        active: undefined,
        skip: 0,
        take: 10,
      });
    });

    it('should list images with custom query and calculate correct skip', async () => {
      mockQueries.findAllImages.mockResolvedValue([[mockImageModel], 25]);

      const query: ImageListQuery = {
        page: 3,
        limit: 5,
        shop_id: 10,
        type: 'product',
        type_id: 100,
        active: true,
      };

      const result = await service.listImages(query);

      expect(result.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        total_pages: 5,
      });
      expect(mockQueries.findAllImages).toHaveBeenCalledWith({
        shop_id: 10,
        type: ImageType.PRODUCT,
        type_id: 100,
        active: true,
        skip: 10,
        take: 5,
      });
    });
  });

  describe('updateImage', () => {
    it('should update image successfully', async () => {
      const updatedModel: ImageModel = {
        ...mockImageModel,
        filename: 'updated.jpg',
        type: ImageType.BANNER,
      };

      mockQueries.findImageById.mockResolvedValue(mockImageModel);
      mockQueries.updateImage.mockResolvedValue(updatedModel);

      const updateData: UpdateImageRequest = {
        filename: 'updated.jpg',
        type: 'banner',
      };

      const result = await service.updateImage(1, updateData, 10);

      expect(result.filename).toBe('updated.jpg');
      expect(result.type).toBe(ImageType.BANNER);
      expect(mockQueries.updateImage).toHaveBeenCalledWith(
        1,
        {
          filename: 'updated.jpg',
          type: ImageType.BANNER,
        },
        10
      );
    });

    it('should throw error if image to update not found', async () => {
      mockQueries.findImageById.mockResolvedValue(null);

      await expect(
        service.updateImage(999, { filename: 'updated.jpg' })
      ).rejects.toThrow('Image not found');

      expect(mockQueries.updateImage).not.toHaveBeenCalled();
    });

    it('should throw error if updated type is invalid', async () => {
      mockQueries.findImageById.mockResolvedValue(mockImageModel);

      const updateData = {
        type: 'invalid_type',
      } as unknown as UpdateImageRequest;

      await expect(service.updateImage(1, updateData)).rejects.toThrow(
        'Invalid image type: invalid_type'
      );

      expect(mockQueries.updateImage).not.toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockQueries.findImageById.mockResolvedValue(mockImageModel);
      mockQueries.deleteImage.mockResolvedValue(true);

      await service.deleteImage(1, 10);

      expect(mockQueries.deleteImage).toHaveBeenCalledWith(1, 10);
    });

    it('should throw error if image to delete not found', async () => {
      mockQueries.findImageById.mockResolvedValue(null);

      await expect(service.deleteImage(999)).rejects.toThrow('Image not found');
      expect(mockQueries.deleteImage).not.toHaveBeenCalled();
    });
  });
});
