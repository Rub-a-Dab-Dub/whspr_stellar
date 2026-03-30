import { DataSource } from 'typeorm';
import { BotCommandsRepository } from './bot-commands.repository';

describe('BotCommandsRepository', () => {
  let repository: BotCommandsRepository;

  beforeEach(() => {
    const dataSource = {
      createEntityManager: jest.fn(),
    } as unknown as DataSource;
    repository = new BotCommandsRepository(dataSource);
  });

  it('replaces commands by deleting old commands first', async () => {
    const deleteSpy = jest.spyOn(repository, 'delete').mockResolvedValue({} as any);
    const createSpy = jest.spyOn(repository, 'create').mockImplementation((entity: any) => entity);
    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue([] as any);

    await repository.replaceForBot('bot-1', [
      { command: '/help', description: 'Show help', usage: '/help' },
      { command: '/ping', description: 'Ping', usage: '/ping' },
    ]);

    expect(deleteSpy).toHaveBeenCalledWith({ botId: 'bot-1' });
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('returns empty array when no commands are provided', async () => {
    jest.spyOn(repository, 'delete').mockResolvedValue({} as any);
    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue([] as any);

    const result = await repository.replaceForBot('bot-1', []);

    expect(result).toEqual([]);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
