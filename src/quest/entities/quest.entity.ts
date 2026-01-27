import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';


@Entity('quests')
export class Quest {
@PrimaryGeneratedColumn('uuid')
id: string;


@Column()
title: string;


@Column()
target: number;


@Column({ default: 0 })
xpReward: number;


@Column({ nullable: true })
badgeReward?: string;
}