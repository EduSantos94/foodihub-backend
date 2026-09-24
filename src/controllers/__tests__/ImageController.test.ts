import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Request, Response } from 'express';
import { ImageController } from '../ImageController.js';
import { ImageService } from '../../services/ImageService.js';
import { ImageType } from '../../database/models/ImageModel.js';
import { ImageResponse, PaginatedResponse } from '../../types/index.js';

vi.mock('../../services/ImageService.js');

interface MockResponse extends Partial<Response> {
  statusCode?: number;
  jsonData?: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

describe('ImageController', () => {
  let controller: ImageController;
  let mockImageService: {
    createImage: Mock;
    getImage: Mock;
    listImages: Mock;
    updateImage: Mock;
    deleteImage: Mock;
  };
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;

  const mockImageResponse: ImageResponse = {
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

    mockImageService = {
      createImage: vi.fn(),
      getImage: vi.fn(),
      listImages: vi.fn(),
      updateImage: vi.fn(),
      deleteImage: vi.fn(),
    };

    controller = new ImageController();
    Reflect.set(controller, 'imageService', mockImageService);

    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    mockResponse = createMockResponse();
  });

  describe('createImage', () => {
    it('should create image successfully and return 201', async () => {
      mockRequest.body = {
        shop_id: 10,
        type: 'product',
        type_id: 100,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
        url_thumbnail: 'https://storage.example.com/test_thumb.jpg',
        file_size: 102400,
        mime_type: 'image/jpeg',
        dimensions: '800x600',
      };

      mockImageService.createImage.mockResolvedValue(mockImageResponse);

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(201);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: mockImageResponse,
        message: 'Image created successfully',
      });
      expect(mockImageService.createImage).toHaveBeenCalledWith(mockRequest.body);
    });

    it('should return 400 if shop_id is missing', async () => {
      mockRequest.body = {
        type: 'product',
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      };

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('shop_id is required');
      expect(mockImageService.createImage).not.toHaveBeenCalled();
    });

    it('should return 400 if type is missing', async () => {
      mockRequest.body = {
        shop_id: 10,
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      };

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('type is required');
      expect(mockImageService.createImage).not.toHaveBeenCalled();
    });

    it('should return 400 if filename is missing', async () => {
      mockRequest.body = {
        shop_id: 10,
        type: 'product',
        rl_original: 'https://storage.example.com/test.jpg',
      };

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('filename is required');
      expect(mockImageService.createImage).not.toHaveBeenCalled();
    });

    it('should return 400 if rl_original is missing', async () => {
      mockRequest.body = {
        shop_id: 10,
        type: 'product',
        filename: 'test.jpg',
      };

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('rl_original is required');
      expect(mockImageService.createImage).not.toHaveBeenCalled();
    });

    it('should handle service errors when creating image', async () => {
      mockRequest.body = {
        shop_id: 10,
        type: 'invalid_type',
        filename: 'test.jpg',
        rl_original: 'https://storage.example.com/test.jpg',
      };

      mockImageService.createImage.mockRejectedValue(new Error('Invalid image type: invalid_type'));

      await controller.createImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid image type: invalid_type');
    });
  });

  describe('getImage', () => {
    it('should get image by id successfully and return 200', async () => {
      mockRequest.params = { id: '1' };
      mockImageService.getImage.mockResolvedValue(mockImageResponse);

      await controller.getImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: mockImageResponse,
      });
      expect(mockImageService.getImage).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass shop_id query param when present', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.query = { shop_id: '10' };
      mockImageService.getImage.mockResolvedValue(mockImageResponse);

      await controller.getImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockImageService.getImage).toHaveBeenCalledWith(1, 10);
    });

    it('should return 400 if id is not a valid number', async () => {
      mockRequest.params = { id: 'abc' };

      await controller.getImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid image ID');
      expect(mockImageService.getImage).not.toHaveBeenCalled();
    });

    it('should return 404 if image is not found', async () => {
      mockRequest.params = { id: '999' };
      mockImageService.getImage.mockRejectedValue(new Error('Image not found'));

      await controller.getImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Image not found');
    });
  });

  describe('listImages', () => {
    it('should list images with default pagination', async () => {
      const paginatedResult: PaginatedResponse<ImageResponse> = {
        data: [mockImageResponse],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      };

      mockRequest.query = {};
      mockImageService.listImages.mockResolvedValue(paginatedResult);

      await controller.listImages(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: paginatedResult.data,
        pagination: paginatedResult.pagination,
      });
      expect(mockImageService.listImages).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        shop_id: undefined,
        type: undefined,
        type_id: undefined,
        active: undefined,
      });
    });

    it('should parse query parameters correctly', async () => {
      const paginatedResult: PaginatedResponse<ImageResponse> = {
        data: [mockImageResponse],
        pagination: {
          page: 2,
          limit: 5,
          total: 10,
          total_pages: 2,
        },
      };

      mockRequest.query = {
        page: '2',
        limit: '5',
        shop_id: '10',
        type: 'product',
        type_id: '100',
        active: 'true',
      };
      mockImageService.listImages.mockResolvedValue(paginatedResult);

      await controller.listImages(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockImageService.listImages).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        shop_id: 10,
        type: 'product',
        type_id: 100,
        active: true,
      });
    });

    it('should handle service errors when listing images', async () => {
      mockRequest.query = {};
      mockImageService.listImages.mockRejectedValue(new Error('Database query failed'));

      await controller.listImages(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Database query failed');
    });
  });

  describe('updateImage', () => {
    it('should update image successfully', async () => {
      const updatedResponse: ImageResponse = {
        ...mockImageResponse,
        filename: 'updated.jpg',
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = { filename: 'updated.jpg' };
      mockImageService.updateImage.mockResolvedValue(updatedResponse);

      await controller.updateImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: updatedResponse,
        message: 'Image updated successfully',
      });
      expect(mockImageService.updateImage).toHaveBeenCalledWith(1, { filename: 'updated.jpg' }, undefined);
    });

    it('should return 400 if id is not a valid number on update', async () => {
      mockRequest.params = { id: 'invalid' };
      mockRequest.body = { filename: 'updated.jpg' };

      await controller.updateImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid image ID');
      expect(mockImageService.updateImage).not.toHaveBeenCalled();
    });

    it('should return 404 if image to update is not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { filename: 'updated.jpg' };
      mockImageService.updateImage.mockRejectedValue(new Error('Image not found'));

      await controller.updateImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Image not found');
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockRequest.params = { id: '1' };
      mockImageService.deleteImage.mockResolvedValue(undefined);

      await controller.deleteImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        message: 'Image deleted successfully',
      });
      expect(mockImageService.deleteImage).toHaveBeenCalledWith(1, undefined);
    });

    it('should return 400 if id is not a valid number on delete', async () => {
      mockRequest.params = { id: 'invalid' };

      await controller.deleteImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid image ID');
      expect(mockImageService.deleteImage).not.toHaveBeenCalled();
    });

    it('should return 404 if image to delete is not found', async () => {
      mockRequest.params = { id: '999' };
      mockImageService.deleteImage.mockRejectedValue(new Error('Image not found'));

      await controller.deleteImage(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Image not found');
    });
  });
});
