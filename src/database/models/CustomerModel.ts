import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('customers')
@Index(['store_id'])
@Index(['email'])
@Index(['active'])
export class CustomerModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 100 })
  first_name: string;

  @Column('varchar', { length: 100, nullable: true })
  last_name?: string;

  @Column('varchar', { length: 255, nullable: true })
  email?: string;

  @Column('varchar', { length: 20, nullable: true })
  phone?: string;

  // unique per store: partial index uq_customers_store_cpf (migration 020)
  @Column('varchar', { length: 11, nullable: true })
  cpf?: string;

  @Column('varchar', { length: 500, nullable: true })
  delivery_address?: string;

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
