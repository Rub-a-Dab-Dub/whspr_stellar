import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VoiceMessage } from './entities/voice-message.entity';
import { VoiceMessageRepository } from './voice-message.repository';

const mockOrm = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('VoiceMessageRepository', () => {
  let repo: VoiceMessageRepository;
  let orm: ReturnType<typeof mockOrm>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VoiceMessageRepository,
        { provide: getRepositoryToken(VoiceMessage), useFactory: mockOrm },
      ],
    }).compile();

    repo = module.get(VoiceMessageRepository);
    orm = module.get(getRepositoryToken(VoiceMessage));
  });

  it('findByMessageId queries confirmed=true with ASC order', async () => {
    orm.find.mockResolvedValue([]);
    await repo.findByMessageId('msg-uuid');
    expect(orm.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId: 'msg-uuid', confirmed: true },
        order: { createdAt: 'ASC' },
      }),
    );
  });

  it('findByFileKey queries by fileKey', async () => {
    orm.findOne.mockResolvedValue(null);
    await repo.findByFileKey('voice/key.ogg');
    expect(orm.findOne).toHaveBeenCalledWith({ where: { fileKey: 'voice/key.ogg' } });
  });

  it('remove delegates to ORM remove', async () => {
    const vm = { id: 'vm-uuid' } as VoiceMessage;
    orm.remove.mockResolvedValue(vm);
    await repo.remove(vm);
    expect(orm.remove).toHaveBeenCalledWith(vm);
  });

  it('save delegates to ORM save', async () => {
    const vm = { id: 'vm-uuid' } as VoiceMessage;
    orm.save.mockResolvedValue(vm);
    expect(await repo.save(vm)).toBe(vm);
  });
});
