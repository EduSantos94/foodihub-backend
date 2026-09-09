import { Repository } from 'typeorm';
import { StoreModel } from '../models/StoreModel';

export class StoreSeed {
  constructor(private repository: Repository<StoreModel>) {}

  async seedDemoStore(): Promise<StoreModel> {
    const existingStore = await this.repository.findOne({
      where: { email: 'demo@foodihub.com' },
    });

    if (existingStore) {
      console.log('Demo store already exists. Skipping...');
      return existingStore;
    }

    const store = this.repository.create({
      name: 'FoodiHub Demo Store',
      email: 'demo@foodihub.com',
      phone: '(11) 9999-9999',
      document: '12345678901234',
      address: 'Rua Demo, 123',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01234-567',
      country: 'Brasil',
      active: true,
    });

    const savedStore = await this.repository.save(store);
    console.log('✓ Demo store created:', savedStore.id);
    return savedStore;
  }

  async seedTestStore(): Promise<StoreModel> {
    const existingStore = await this.repository.findOne({
      where: { email: 'test@foodihub.com' },
    });

    if (existingStore) {
      console.log('Test store already exists. Skipping...');
      return existingStore;
    }

    const store = this.repository.create({
      name: 'FoodiHub Test Store',
      email: 'test@foodihub.com',
      phone: '(11) 8888-8888',
      document: '98765432109876',
      address: 'Av Teste, 456',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip_code: '20000-000',
      country: 'Brasil',
      active: true,
    });

    const savedStore = await this.repository.save(store);
    console.log('✓ Test store created:', savedStore.id);
    return savedStore;
  }

  async seedMultipleStores(count: number = 5): Promise<StoreModel[]> {
    const stores: StoreModel[] = [];
    const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Salvador'];

    for (let i = 0; i < count; i++) {
      const storeNumber = i + 1;
      const email = `store${storeNumber}@foodihub.com`;

      const existingStore = await this.repository.findOne({ where: { email } });

      if (existingStore) {
        console.log(`Store ${storeNumber} already exists. Skipping...`);
        stores.push(existingStore);
        continue;
      }

      const store = this.repository.create({
        name: `FoodiHub Store ${storeNumber}`,
        email,
        phone: `(11) ${7000 + i}${0 + i}-${1000 + i}`,
        document: `${12345678901234 + i}`,
        address: `Rua Store ${storeNumber}, ${storeNumber * 100}`,
        city: cities[i % cities.length],
        state: i % 2 === 0 ? 'SP' : 'RJ',
        zip_code: `0${i}000-000`,
        country: 'Brasil',
        active: true,
      });

      const savedStore = await this.repository.save(store);
      console.log(`✓ Store ${storeNumber} created:`, savedStore.id);
      stores.push(savedStore);
    }

    return stores;
  }

  async deleteByEmail(email: string): Promise<boolean> {
    const result = await this.repository.delete({ email });
    return (result.affected || 0) > 0;
  }

  async deleteAll(): Promise<number> {
    const result = await this.repository.delete({});
    return result.affected || 0;
  }
}
