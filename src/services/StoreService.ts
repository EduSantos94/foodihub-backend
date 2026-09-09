import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { StoreModel } from '../database/models/StoreModel.js';
import { UserModel } from '../database/models/UserModel.js';
import {
  CreateStoreRequest,
  UpdateStoreRequest,
  StoreResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class StoreService {
  private storeRepository?: Repository<StoreModel>;
  private userRepository?: Repository<UserModel>;

  private async ensureRepositories() {
    if (!this.storeRepository || !this.userRepository) {
      const dataSource = await createDataSource();
      this.storeRepository = dataSource.getRepository(StoreModel);
      this.userRepository = dataSource.getRepository(UserModel);
    }
  }

  async createStore(data: CreateStoreRequest): Promise<StoreResponse> {
    await this.ensureRepositories();
    const existingStore = await this.storeRepository!.findOne({
      where: { document: data.document },
    });

    if (existingStore) {
      throw new Error('Store with this document already exists');
    }

    const store = this.storeRepository!.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      document: data.document,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      country: data.country || 'Brasil',
      active: true,
    });

    const savedStore = await this.storeRepository!.save(store);
    return this.mapToResponse(savedStore);
  }

  async getStoreById(id: string): Promise<StoreResponse> {
    await this.ensureRepositories();
    const store = await this.storeRepository!.findOne({
      where: { id, deleted_at: null },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return this.mapToResponse(store);
  }

  async updateStore(
    id: string,
    data: UpdateStoreRequest
  ): Promise<StoreResponse> {
    await this.ensureRepositories();
    const store = await this.storeRepository!.findOne({
      where: { id, deleted_at: null },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    Object.assign(store, data);
    store.updated_at = new Date();

    const updatedStore = await this.storeRepository!.save(store);
    return this.mapToResponse(updatedStore);
  }

  async getAllStores(
    query: PaginationQuery
  ): Promise<PaginatedResponse<StoreResponse>> {
    await this.ensureRepositories();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [stores, total] = await this.storeRepository!.findAndCount({
      where: { deleted_at: null },
      skip,
      take: limit,
      order: {
        created_at: query.order || 'DESC',
      },
    });

    return {
      data: stores.map((store) => this.mapToResponse(store)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async deactivateStore(id: string): Promise<StoreResponse> {
    await this.ensureRepositories();
    const store = await this.storeRepository!.findOne({
      where: { id, deleted_at: null },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    store.active = false;
    store.updated_at = new Date();

    const updatedStore = await this.storeRepository!.save(store);
    return this.mapToResponse(updatedStore);
  }

  async softDeleteStore(id: string): Promise<void> {
    await this.ensureRepositories();
    const store = await this.storeRepository!.findOne({
      where: { id, deleted_at: null },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    store.deleted_at = new Date();
    await this.storeRepository!.save(store);
  }

  async getUserCountByStore(storeId: string): Promise<number> {
    await this.ensureRepositories();
    return this.userRepository!.count({
      where: { store_id: storeId },
    });
  }

  private mapToResponse(store: StoreModel): StoreResponse {
    return {
      id: store.id,
      name: store.name,
      email: store.email,
      phone: store.phone,
      document: store.document,
      address: store.address,
      city: store.city,
      state: store.state,
      zip_code: store.zip_code,
      country: store.country,
      active: store.active,
      created_at: store.created_at,
      updated_at: store.updated_at,
    };
  }
}
