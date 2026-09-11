import { Repository } from 'typeorm';
import { UserModel, UserRole } from '../models/UserModel';
import bcrypt from 'bcryptjs';

export class UserSeed {
  constructor(private repository: Repository<UserModel>) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async seedAdminUser(storeId: string, email: string = 'admin@demo.com'): Promise<UserModel> {
    const existingUser = await this.repository.findOne({ where: { email } });

    if (existingUser) {
      console.log('Admin user already exists. Skipping...');
      return existingUser;
    }

    const hashedPassword = await this.hashPassword('admin123');

    const user = this.repository.create({
      store_id: storeId,
      email,
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'Demo',
      phone: '(11) 9999-8888',
      role: UserRole.ADMIN,
      active: true,
    });

    const savedUser = await this.repository.save(user);
    console.log('✓ Admin user created:', savedUser.id);
    return savedUser;
  }

  async seedManagerUser(storeId: string, email: string = 'manager@demo.com'): Promise<UserModel> {
    const existingUser = await this.repository.findOne({ where: { email } });

    if (existingUser) {
      console.log('Manager user already exists. Skipping...');
      return existingUser;
    }

    const hashedPassword = await this.hashPassword('manager123');

    const user = this.repository.create({
      store_id: storeId,
      email,
      password_hash: hashedPassword,
      first_name: 'Manager',
      last_name: 'Demo',
      phone: '(11) 9999-7777',
      role: UserRole.MANAGER,
      active: true,
    });

    const savedUser = await this.repository.save(user);
    console.log('✓ Manager user created:', savedUser.id);
    return savedUser;
  }

  async seedStaffUser(storeId: string, email: string = 'staff@demo.com'): Promise<UserModel> {
    const existingUser = await this.repository.findOne({ where: { email } });

    if (existingUser) {
      console.log('Staff user already exists. Skipping...');
      return existingUser;
    }

    const hashedPassword = await this.hashPassword('staff123');

    const user = this.repository.create({
      store_id: storeId,
      email,
      password_hash: hashedPassword,
      first_name: 'Staff',
      last_name: 'Demo',
      phone: '(11) 9999-6666',
      role: UserRole.STAFF,
      active: true,
    });

    const savedUser = await this.repository.save(user);
    console.log('✓ Staff user created:', savedUser.id);
    return savedUser;
  }

  async seedDemoUsers(storeId: string): Promise<UserModel[]> {
    const users: UserModel[] = [];

    const admin = await this.seedAdminUser(storeId, 'admin@demo.com');
    users.push(admin);

    const manager = await this.seedManagerUser(storeId, 'manager@demo.com');
    users.push(manager);

    const staff = await this.seedStaffUser(storeId, 'staff@demo.com');
    users.push(staff);

    return users;
  }

  async seedMultipleUsers(storeId: string, count: number = 5): Promise<UserModel[]> {
    const users: UserModel[] = [];
    const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];

    for (let i = 0; i < count; i++) {
      const userNumber = i + 1;
      const email = `user${userNumber}@demo.com`;

      const existingUser = await this.repository.findOne({ where: { email } });

      if (existingUser) {
        console.log(`User ${userNumber} already exists. Skipping...`);
        users.push(existingUser);
        continue;
      }

      const hashedPassword = await this.hashPassword(`password${userNumber}`);
      const role = roles[i % roles.length];

      const user = this.repository.create({
        store_id: storeId,
        email,
        password_hash: hashedPassword,
        first_name: `User`,
        last_name: `${userNumber}`,
        phone: `(11) 9${1000 + i}-${2000 + i}`,
        role,
        active: true,
      });

      const savedUser = await this.repository.save(user);
      console.log(`✓ User ${userNumber} (${role}) created:`, savedUser.id);
      users.push(savedUser);
    }

    return users;
  }

  async createUser(
    storeId: string,
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    role: UserRole = UserRole.STAFF,
    phone?: string
  ): Promise<UserModel> {
    const existingUser = await this.repository.findOne({ where: { email } });

    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }

    const hashedPassword = await this.hashPassword(password);

    const user = this.repository.create({
      store_id: storeId,
      email,
      password_hash: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
      active: true,
    });

    return this.repository.save(user);
  }

  async deleteByEmail(email: string): Promise<boolean> {
    const result = await this.repository.delete({ email });
    return (result.affected || 0) > 0;
  }

  async deleteByStoreId(storeId: string): Promise<number> {
    const result = await this.repository.delete({ store_id: storeId });
    return result.affected || 0;
  }

  async deleteAll(): Promise<number> {
    const result = await this.repository.delete({});
    return result.affected || 0;
  }
}
