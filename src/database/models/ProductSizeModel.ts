import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('product_sizes')
@Index(['product_id'])
@Index(['store_id'])
@Index(['active'])
export class ProductSizeModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  product_id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 100 })
  name: string;

  @Column('boolean', { default: true })
  active: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @ManyToOne('ProductModel', 'sizes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
