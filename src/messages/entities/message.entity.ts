import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum MessageType {
    TEXT = 'TEXT',
    MEDIA = 'MEDIA',
    TIP = 'TIP',
}

@Entity('messages')
@Index(['roomId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne('User', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender_id' })
    sender: unknown;

    @Column({ name: 'sender_id' })
    senderId: string;

    @Column({ name: 'room_id' })
    roomId: string;

    @Column({
        type: 'enum',
        enum: MessageType,
        default: MessageType.TEXT,
    })
    type: MessageType;

    @Column({ type: 'text', nullable: true })
    content: string | null;

    @Column({ name: 'payment_id', nullable: true })
    @Index()
    paymentId: string | null;

    @ManyToOne('Payment', { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'payment_id' })
    payment: unknown | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
