import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';

@Injectable()
export class RoomRepository extends Repository<Room> {
  constructor(private dataSource: DataSource) {
    super(Room, dataSource.createEntityManager());
  }

  async findActiveById(roomId: string): Promise<Room | null> {
    return this.findOne({ where: { id: roomId, isDeleted: false } });
  }

  async findActiveWithOwner(roomId: string): Promise<Room | null> {
    return this.findOne({
      where: { id: roomId, isDeleted: false },
      relations: ['owner'],
    });
  }

  async isNameTaken(name: string): Promise<boolean> {
    const count = await this.count({ where: { name, isDeleted: false } });
    return count > 0;
  }

  async softDeleteRoom(roomId: string): Promise<void> {
    await this.update(roomId, {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    });
  }
}
