import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ImageType {
  SHOP = 'shop',
  PRODUCT = 'product',
  SUPPLIER = 'supplier',
  BANNER = 'banner',
  CATEGORY = 'category',
  PROMOTIONAL = 'promotional',
  OTHERS = 'others',
}

@Entity('images')
@Index(['shop_id', 'type', 'type_id'])
@Index(['uploaded_at'])
export class ImageModel {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column('int')
  shop_id: number;

  @Column('enum', { enum: ImageType })
  type: ImageType;

  @Column('int', { nullable: true })
  type_id?: number;

  @Column('varchar', { length: 500 })
  filename: string;

  @Column('varchar', { length: 500 })
  rl_original: string;

  @Column('varchar', { length: 500, nullable: true })
  url_thumbnail?: string;

  @Column('int', { nullable: true })
  file_size?: number;

  @Column('varchar', { length: 50, nullable: true })
  mime_type?: string;

  @Column('varchar', { length: 20, nullable: true })
  dimensions?: string;

  @CreateDateColumn()
  uploaded_at: Date;

  @Column('boolean', { default: true })
  active: boolean;
}
