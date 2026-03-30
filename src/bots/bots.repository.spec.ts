import { DataSource } from 'typeorm';
import { BotsRepository } from './bots.repository';

describe('BotsRepository', () => {
  let repository: BotsRepository;

  beforeEach(() => {
    const dataSource = {
      createEntityManager: jest.fn(),
    } as unknown as DataSource;
    repository = new BotsRepository(dataSource);
  });

  it('findByOwner delegates to find with expected filters', async () => {
    const findSpy = jest.spyOn(repository, 'find').mockResolvedValue([]);
    await repository.findByOwner('owner-1');

    expect(findSpy).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
      relations: ['commands'],
      order: { createdAt: 'DESC', commands: { command: 'ASC' } },
    });
  });

  it('findOwnedBot delegates to findOne with owner and bot id', async () => {
    const findOneSpy = jest.spyOn(repository, 'findOne').mockResolvedValue(null);
    await repository.findOwnedBot('owner-1', 'bot-1');

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { id: 'bot-1', ownerId: 'owner-1' },
      relations: ['commands'],
    });
  });
});
