import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum SupplyType {
  INGREDIENT = 'ingredient',
  PACKAGING = 'packaging',
  CLEANING = 'cleaning',
  UTENSIL = 'utensil',
  OFFICE = 'office',
  OTHER = 'other',
}

export enum UnitMeasure {
  UN = 'un',
  KG = 'kg',
  G = 'g',
  L = 'l',
  ML = 'ml',
  CX = 'cx',
  PCT = 'pct',
  DZ = 'dz',
  M = 'm',
  OTHER = 'other',
}

@Entity('supplies')
@Unique(['store_id', 'name'])
@Index(['store_id'])
@Index(['store_id', 'type'])
@Index(['active'])
export class SupplyModel {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('enum', { enum: SupplyType, default: SupplyType.INGREDIENT })
  type: SupplyType;

  @Column('enum', { enum: UnitMeasure })
  unit_measure: UnitMeasure;

  @Column('text', { nullable: true })
  description?: string;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
