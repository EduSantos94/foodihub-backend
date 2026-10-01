import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ImageEntityType = 'store' | 'product' | 'supplier' | 'banner' | 'category' | 'promotional' | 'other';

@Entity('images')
@Index(['store_id', 'entity_type', 'entity_id'])
@Index(['store_id'])
export class ImageModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 50 })
  entity_type: ImageEntityType;

  @Column('uuid', { nullable: true })
  entity_id?: string;

  @Column('varchar', { length: 500 })
  filename: string;

  @Column('varchar', { length: 500 })
  url_original: string;

  @Column('varchar', { length: 500, nullable: true })
  url_thumbnail?: string;

  @Column('int', { nullable: true })
  file_size?: number;

  @Column('varchar', { length: 50, nullable: true })
  mime_type?: string;

  @Column('varchar', { length: 20, nullable: true })
  dimensions?: string;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn()
  uploaded_at: Date;
}
