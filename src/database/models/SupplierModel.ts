import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('suppliers')
@Index(['store_id'])
@Index(['store_id', 'active'])
export class SupplierModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 18, unique: true, nullable: true })
  cnpj?: string;

  @Column('varchar', { length: 20, nullable: true })
  phone?: string;

  @Column('varchar', { length: 255, nullable: true })
  email?: string;

  @Column('varchar', { length: 255, nullable: true })
  contact_person?: string;

  @Column('varchar', { length: 500, nullable: true })
  address?: string;

  @Column('varchar', { length: 100, nullable: true })
  city?: string;

  @Column('varchar', { length: 2, nullable: true })
  state?: string;

  @Column('varchar', { length: 10, nullable: true })
  zip_code?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date;
}
