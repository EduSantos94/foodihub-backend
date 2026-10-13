import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export type SaleStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type SalePaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer';
export type SalePaymentStatus = 'pending' | 'paid' | 'cancelled';
export type DeliveryType = 'takeout' | 'delivery' | 'dine_in';

@Entity('sales')
@Index(['store_id', 'status'])
@Index(['store_id', 'sale_date'])
@Index(['payment_status'])
@Index(['customer_id'])
export class SaleModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('uuid', { nullable: true })
  customer_id?: string;

  @Column('varchar', { length: 50, nullable: true })
  sale_number?: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  sale_date: Date;

  @Column('varchar', { length: 20, default: 'takeout' })
  delivery_type: DeliveryType;

  @Column('varchar', { length: 500, nullable: true })
  delivery_address?: string;

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 12, scale: 2 })
  total_amount: number;

  @Column('varchar', { length: 20, default: 'pending' })
  status: SaleStatus;

  @Column('varchar', { length: 20, default: 'cash' })
  payment_method: SalePaymentMethod;

  @Column('varchar', { length: 20, default: 'pending' })
  payment_status: SalePaymentStatus;

  @Column('timestamp', { nullable: true })
  paid_at?: Date;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('uuid', { nullable: true })
  created_by?: string;

  // Uses string reference to avoid circular dependency with SaleItemModel
  @OneToMany('SaleItemModel', 'sale', { cascade: true, eager: false })
  items?: any[];

  @OneToMany('SaleIntegrationModel', 'sale', { eager: false })
  integrations?: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
