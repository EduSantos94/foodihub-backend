import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'pix' | 'other';

@Entity('purchases')
@Index(['store_id'])
@Index(['store_id', 'supplier_id'])
@Index(['purchase_date'])
@Index(['payment_status'])
export class PurchaseModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('uuid')
  supplier_id: string;

  @Column('varchar', { length: 50, nullable: true })
  purchase_number?: string;

  @Column('date')
  purchase_date: Date;

  @Column('date', { nullable: true })
  delivery_date?: Date;

  @Column('varchar', { length: 50, nullable: true })
  invoice_number?: string;

  @Column('date', { nullable: true })
  invoice_date?: Date;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  paid_amount: number;

  @Column('varchar', { length: 20, default: 'pending' })
  payment_status: PaymentStatus;

  @Column('varchar', { length: 20, default: 'cash', nullable: true })
  payment_method?: PaymentMethod;

  @Column('date', { nullable: true })
  payment_date?: Date;

  @Column('text', { nullable: true })
  notes?: string;

  // Uses string reference to avoid circular dependency with PurchaseItemModel
  @OneToMany('PurchaseItemModel', 'purchase', { cascade: true, eager: false })
  items?: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
