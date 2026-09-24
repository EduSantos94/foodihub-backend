import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { ImageModel, ImageType } from '../database/models/ImageModel.js';
import { ImageQueries } from '../database/queries/ImageQueries.js';
import {
  CreateImageRequest,
  UpdateImageRequest,
  ImageResponse,
  PaginatedResponse,
  ImageListQuery,
} from '../types/index.js';

export class ImageService {
  private queries?: ImageQueries;

  private async ensureQueries(): Promise<ImageQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const repo: Repository<ImageModel> = ds.getRepository(ImageModel);
      this.queries = new ImageQueries(repo);
    }
    return this.queries;
  }

  async createImage(data: CreateImageRequest): Promise<ImageResponse> {
    const q = await this.ensureQueries();

    if (!data.shop_id) {
      throw new Error('shop_id is required');
    }
    if (!data.type) {
      throw new Error('type is required');
    }
    if (!Object.values(ImageType).includes(data.type as ImageType)) {
      throw new Error(`Invalid image type: ${data.type}`);
    }
    if (!data.filename) {
      throw new Error('filename is required');
    }
    if (!data.rl_original) {
      throw new Error('rl_original is required');
    }

    const image = await q.createImage({
      shop_id: data.shop_id,
      type: data.type as ImageType,
      type_id: data.type_id,
      filename: data.filename,
      rl_original: data.rl_original,
      url_thumbnail: data.url_thumbnail,
      file_size: data.file_size,
      mime_type: data.mime_type,
      dimensions: data.dimensions,
      active: data.active !== undefined ? data.active : true,
    });

    return this.mapImage(image);
  }

  async getImage(id: number, shopId?: number): Promise<ImageResponse> {
    const q = await this.ensureQueries();
    const image = await q.findImageById(id, shopId);
    if (!image) {
      throw new Error('Image not found');
    }
    return this.mapImage(image);
  }

  async listImages(query: ImageListQuery = {}): Promise<PaginatedResponse<ImageResponse>> {
    const q = await this.ensureQueries();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [images, total] = await q.findAllImages({
      shop_id: query.shop_id !== undefined ? Number(query.shop_id) : undefined,
      type: query.type as ImageType | undefined,
      type_id: query.type_id !== undefined ? Number(query.type_id) : undefined,
      active: query.active,
      skip,
      take: limit,
    });

    return {
      data: images.map((img) => this.mapImage(img)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async updateImage(
    id: number,
    data: UpdateImageRequest,
    shopId?: number
  ): Promise<ImageResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findImageById(id, shopId);
    if (!existing) {
      throw new Error('Image not found');
    }

    if (data.type && !Object.values(ImageType).includes(data.type as ImageType)) {
      throw new Error(`Invalid image type: ${data.type}`);
    }

    const updated = await q.updateImage(
      id,
      {
        ...data,
        type: data.type as ImageType | undefined,
      },
      shopId
    );

    return this.mapImage(updated!);
  }

  async deleteImage(id: number, shopId?: number): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findImageById(id, shopId);
    if (!existing) {
      throw new Error('Image not found');
    }
    await q.deleteImage(id, shopId);
  }

  private mapImage(img: ImageModel): ImageResponse {
    return {
      id: img.id,
      shop_id: img.shop_id,
      type: img.type,
      type_id: img.type_id,
      filename: img.filename,
      rl_original: img.rl_original,
      url_thumbnail: img.url_thumbnail,
      file_size: img.file_size,
      mime_type: img.mime_type,
      dimensions: img.dimensions,
      uploaded_at: img.uploaded_at,
      active: img.active,
    };
  }
}
