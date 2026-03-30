import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("link_previews")
export class LinkPreview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  favicon: string;

  @Column({ nullable: true })
  siteName: string;

  @Column({ type: "timestamp", nullable: true })
  fetchedAt: Date;

  @Column({ default: false })
  isFailed: boolean;
}
