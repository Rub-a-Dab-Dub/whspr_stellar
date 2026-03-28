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

  it('replaceForBot deletes existing commands then saves new ones', async () => {
    const deleteSpy = jest.spyOn(repository, 'delete').mockResolvedValue({} as any);
    const createSpy = jest.spyOn(repository, 'create').mockImplementation((entity: any) => entity);
    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue([
      {
        botId: 'bot-1',
        command: '/help',
        description: 'Show help',
        usage: '/help',
      },
    ] as any);

    const result = await repository.replaceForBot('bot-1', [
      { command: '/help', description: 'Show help', usage: '/help' },
    ]);

    expect(deleteSpy).toHaveBeenCalledWith({ botId: 'bot-1' });
    expect(createSpy).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('replaceForBot returns empty list when no commands are provided', async () => {
    jest.spyOn(repository, 'delete').mockResolvedValue({} as any);
    const saveSpy = jest.spyOn(repository, 'save');

    const result = await repository.replaceForBot('bot-1', []);

    expect(result).toEqual([]);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
