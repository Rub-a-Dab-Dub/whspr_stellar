// src/roles/entities/role.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Permission } from './permission.entity';
import { UserRole } from './user-role.enum';
export { UserRole } from './user-role.enum';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    unique: true,
  })
  name: UserRole;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  hierarchy: number; // Higher number = more privileges

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    eager: true,
    cascade: true,
  })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
