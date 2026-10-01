import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { ImageModel, ImageEntityType } from '../database/models/ImageModel.js';
import { ImageQueries } from '../database/queries/ImageQueries.js';
import {
  CreateImageRequest,
  UpdateImageRequest,
  ImageResponse,
  PaginatedResponse,
  PaginationQuery,
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

  async createImage(storeId: string, data: CreateImageRequest): Promise<ImageResponse> {
    const q = await this.ensureQueries();
    const image = await q.createImage({
      store_id: storeId,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      filename: data.filename,
      url_original: data.url_original,
      url_thumbnail: data.url_thumbnail,
      file_size: data.file_size,
      mime_type: data.mime_type,
      dimensions: data.dimensions,
      active: true,
    });
    return this.mapImage(image);
  }

  async getImage(id: string, storeId: string): Promise<ImageResponse> {
    const q = await this.ensureQueries();
    const image = await q.findImageById(id, storeId);
    if (!image) throw new Error('Image not found');
    return this.mapImage(image);
  }

  async listImages(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<ImageResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [images, total] = await q.findAllByStore(storeId, skip, limit);
    return {
      data: images.map((i) => this.mapImage(i)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async listImagesByEntity(
    storeId: string,
    entityType: ImageEntityType,
    entityId?: string
  ): Promise<ImageResponse[]> {
    const q = await this.ensureQueries();
    const images = await q.findByEntity(storeId, entityType, entityId);
    return images.map((i) => this.mapImage(i));
  }

  async updateImage(id: string, storeId: string, data: UpdateImageRequest): Promise<ImageResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findImageById(id, storeId);
    if (!existing) throw new Error('Image not found');
    const updated = await q.updateImage(id, storeId, data);
    return this.mapImage(updated!);
  }

  async deleteImage(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findImageById(id, storeId);
    if (!existing) throw new Error('Image not found');
    await q.deleteImage(id, storeId);
  }

  private mapImage(i: ImageModel): ImageResponse {
    return {
      id: i.id,
      store_id: i.store_id,
      entity_type: i.entity_type,
      entity_id: i.entity_id,
      filename: i.filename,
      url_original: i.url_original,
      url_thumbnail: i.url_thumbnail,
      file_size: i.file_size,
      mime_type: i.mime_type,
      dimensions: i.dimensions,
      active: i.active,
      uploaded_at: i.uploaded_at,
    };
  }
}
