import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('sale_items')
@Index(['sale_id'])
@Index(['product_id'])
export class SaleItemModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  sale_id: string;

  @Column('uuid')
  product_id: string;

  @Column('uuid', { nullable: true })
  product_size_id?: string;

  @Column('varchar', { length: 255, nullable: true })
  product_name?: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column('decimal', { precision: 12, scale: 2 })
  total_price: number;

  @Column('text', { nullable: true })
  notes?: string;

  // Uses string reference to avoid circular dependency with SaleModel
  @ManyToOne('SaleModel', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale?: any;
}
