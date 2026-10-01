import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageController } from '../ImageController.js';
import { ImageService } from '../../services/ImageService.js';

vi.mock('../../services/ImageService.js');

describe('ImageController', () => {
  let controller: ImageController;
  let mockImageService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockImageId = 'image-456';

  const mockImage = {
    id: mockImageId,
    store_id: mockStoreId,
    entity_type: 'product',
    filename: 'pizza.jpg',
    url_original: 'https://cdn.example.com/pizza.jpg',
    active: true,
    uploaded_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockImageService = {
      createImage: vi.fn(),
      getImage: vi.fn(),
      listImages: vi.fn(),
      listImagesByEntity: vi.fn(),
      updateImage: vi.fn(),
      deleteImage: vi.fn(),
    };
    controller = new ImageController();
    (controller as any).imageService = mockImageService;
    mockRequest = { user: { store_id: mockStoreId }, body: {}, params: {}, query: {} };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('createImage', () => {
    it('should create image successfully', async () => {
      mockRequest.body = {
        filename: 'pizza.jpg',
        url_original: 'https://cdn.example.com/pizza.jpg',
        entity_type: 'product',
      };
      mockImageService.createImage.mockResolvedValue(mockImage);

      await controller.createImage(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Image created successfully' })
      );
    });

    it('should return 400 if required fields missing', async () => {
      mockRequest.body = { filename: 'pizza.jpg' };

      await controller.createImage(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'filename, url_original and entity_type are required' })
      );
    });

    it('should return 400 if entity_type is invalid', async () => {
      mockRequest.body = {
        filename: 'pizza.jpg',
        url_original: 'https://cdn.example.com/pizza.jpg',
        entity_type: 'invalid_type',
      };

      await controller.createImage(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getImage', () => {
    it('should return image by id', async () => {
      mockRequest.params = { id: mockImageId };
      mockImageService.getImage.mockResolvedValue(mockImage);

      await controller.getImage(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockImage })
      );
    });

    it('should return 404 if not found', async () => {
      mockRequest.params = { id: mockImageId };
      mockImageService.getImage.mockRejectedValue(new Error('Image not found'));

      await controller.getImage(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listImages', () => {
    it('should list images with pagination', async () => {
      mockImageService.listImages.mockResolvedValue({
        data: [mockImage],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });

      await controller.listImages(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [mockImage] })
      );
    });
  });

  describe('listImagesByEntity', () => {
    it('should list images by entity type', async () => {
      mockRequest.params = { entityType: 'product' };
      mockRequest.query = { entity_id: 'product-789' };
      mockImageService.listImagesByEntity.mockResolvedValue([mockImage]);

      await controller.listImagesByEntity(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [mockImage] })
      );
      expect(mockImageService.listImagesByEntity).toHaveBeenCalledWith(
        mockStoreId, 'product', 'product-789'
      );
    });

    it('should return 400 for invalid entity_type', async () => {
      mockRequest.params = { entityType: 'invalid' };

      await controller.listImagesByEntity(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateImage', () => {
    it('should update image successfully', async () => {
      mockRequest.params = { id: mockImageId };
      mockRequest.body = { active: false };
      mockImageService.updateImage.mockResolvedValue({ ...mockImage, active: false });

      await controller.updateImage(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Image updated successfully' })
      );
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockRequest.params = { id: mockImageId };
      mockImageService.deleteImage.mockResolvedValue(undefined);

      await controller.deleteImage(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Image deleted successfully' })
      );
    });

    it('should return 404 if not found', async () => {
      mockRequest.params = { id: mockImageId };
      mockImageService.deleteImage.mockRejectedValue(new Error('Image not found'));

      await controller.deleteImage(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
