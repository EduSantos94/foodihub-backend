import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export type SupplyType = 'ingredient' | 'packaging' | 'cleaning' | 'other';

@Entity('supplies')
@Index(['store_id'])
@Index(['store_id', 'type'])
@Index(['active'])
@Unique(['store_id', 'name'])
export class SupplyModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 50, default: 'ingredient' })
  type: SupplyType;

  @Column('varchar', { length: 20 })
  unit_measure: string;

  @Column('numeric', { precision: 15, scale: 4, default: 0 })
  amount: number;

  @Column('text', { nullable: true })
  description?: string;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
