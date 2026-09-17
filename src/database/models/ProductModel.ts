import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

@Entity('products')
@Index(['store_id'])
@Index(['active'])
@Index(['category_id'])
@Index(['store_id', 'active'])
export class ProductModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('uuid', { nullable: true })
  category_id?: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column('int', { default: 0 })
  amount: number;

  @Column('boolean', { default: true })
  active: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @OneToMany('ProductSizeModel', 'product', { cascade: true, eager: false })
  sizes?: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date;
}
