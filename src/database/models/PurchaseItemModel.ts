import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('purchase_items')
@Index(['purchase_id'])
@Index(['supply_id'])
@Index(['expiry_date'])
export class PurchaseItemModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  purchase_id: string;

  @Column('uuid')
  supply_id: string;

  @Column('decimal', { precision: 15, scale: 4 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 4 })
  unit_price: number;

  @Column('decimal', { precision: 12, scale: 4 })
  total_price: number;

  @Column('varchar', { length: 50, nullable: true })
  batch_number?: string;

  @Column('date', { nullable: true })
  manufacturing_date?: Date;

  @Column('date', { nullable: true })
  expiry_date?: Date;

  // Uses string reference to avoid circular dependency with PurchaseModel
  @ManyToOne('PurchaseModel', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: any;
}
