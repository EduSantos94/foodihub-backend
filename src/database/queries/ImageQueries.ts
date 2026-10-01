import { Repository } from 'typeorm';
import { ImageModel, ImageEntityType } from '../models/ImageModel.js';

export class ImageQueries {
  constructor(private imageRepository: Repository<ImageModel>) {}

  async createImage(data: Partial<ImageModel>): Promise<ImageModel> {
    const image = this.imageRepository.create(data);
    return this.imageRepository.save(image);
  }

  async findImageById(id: string, storeId: string): Promise<ImageModel | null> {
    return this.imageRepository.findOne({
      where: { id, store_id: storeId },
    });
  }

  async findAllByStore(
    storeId: string,
    skip = 0,
    take = 10
  ): Promise<[ImageModel[], number]> {
    return this.imageRepository.findAndCount({
      where: { store_id: storeId },
      order: { uploaded_at: 'DESC' },
      skip,
      take,
    });
  }

  async findByEntity(
    storeId: string,
    entityType: ImageEntityType,
    entityId?: string
  ): Promise<ImageModel[]> {
    const where: any = { store_id: storeId, entity_type: entityType };
    if (entityId) where.entity_id = entityId;
    return this.imageRepository.find({
      where,
      order: { uploaded_at: 'DESC' },
    });
  }

  async updateImage(id: string, storeId: string, data: Partial<ImageModel>): Promise<ImageModel | null> {
    await this.imageRepository.update({ id, store_id: storeId }, data);
    return this.findImageById(id, storeId);
  }

  async deleteImage(id: string, storeId: string): Promise<boolean> {
    const result = await this.imageRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }
}
