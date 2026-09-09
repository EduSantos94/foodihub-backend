import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Check,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
}

@Entity('users')
@Index(['store_id'])
@Index(['email'])
@Index(['active'])
@Index(['role'])
@Check(`"role" IN ('admin', 'manager', 'staff')`)
export class UserModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 255, unique: true })
  email: string;

  @Column('varchar', { length: 255 })
  password_hash: string;

  @Column('varchar', { length: 100 })
  first_name: string;

  @Column('varchar', { length: 100, nullable: true })
  last_name?: string;

  @Column('varchar', { length: 20, nullable: true })
  phone?: string;

  @Column('enum', { enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('timestamp', { nullable: true })
  last_login?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date;
}
