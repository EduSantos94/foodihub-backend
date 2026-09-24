import { Repository, FindOptionsWhere } from 'typeorm';
import { ImageModel, ImageType } from '../models/ImageModel.js';

export interface FindImagesOptions {
  shop_id?: number;
  type?: ImageType;
  type_id?: number;
  active?: boolean;
  skip?: number;
  take?: number;
}

export class ImageQueries {
  constructor(private imageRepository: Repository<ImageModel>) {}

  async createImage(data: Partial<ImageModel>): Promise<ImageModel> {
    const image = this.imageRepository.create(data);
    return this.imageRepository.save(image);
  }

  async findImageById(id: number, shopId?: number): Promise<ImageModel | null> {
    const where: FindOptionsWhere<ImageModel> = { id };
    if (shopId !== undefined) {
      where.shop_id = shopId;
    }
    return this.imageRepository.findOne({ where });
  }

  async findAllImages(options: FindImagesOptions = {}): Promise<[ImageModel[], number]> {
    const { shop_id, type, type_id, active, skip = 0, take = 10 } = options;
    const where: FindOptionsWhere<ImageModel> = {};

    if (shop_id !== undefined) {
      where.shop_id = shop_id;
    }
    if (type !== undefined) {
      where.type = type;
    }
    if (type_id !== undefined) {
      where.type_id = type_id;
    }
    if (active !== undefined) {
      where.active = active;
    }

    return this.imageRepository.findAndCount({
      where,
      order: { uploaded_at: 'DESC' },
      skip,
      take,
    });
  }

  async updateImage(
    id: number,
    data: Partial<ImageModel>,
    shopId?: number
  ): Promise<ImageModel | null> {
    const where: FindOptionsWhere<ImageModel> = { id };
    if (shopId !== undefined) {
      where.shop_id = shopId;
    }
    await this.imageRepository.update(where, data);
    return this.findImageById(id, shopId);
  }

  async deleteImage(id: number, shopId?: number): Promise<boolean> {
    const where: FindOptionsWhere<ImageModel> = { id };
    if (shopId !== undefined) {
      where.shop_id = shopId;
    }
    const result = await this.imageRepository.delete(where);
    return (result.affected || 0) > 0;
  }
}
