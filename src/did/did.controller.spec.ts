import { BadRequestException } from '@nestjs/common';
import { DidController } from './did.controller';
import { DidService } from './did.service';

describe('DidController', () => {
  let controller: DidController;
  let didService: jest.Mocked<Pick<DidService, keyof DidService>>;

  beforeEach(() => {
    didService = {
      registerDID: jest.fn(),
      resolveDID: jest.fn(),
      updateDIDDocument: jest.fn(),
      issueCredential: jest.fn(),
      verifyCredential: jest.fn(),
      revokeCredential: jest.fn(),
      deleteCredential: jest.fn(),
      getDIDByUser: jest.fn(),
      listCredentials: jest.fn(),
      linkCredential: jest.fn(),
      getPublicProfileCredentials: jest.fn(),
    };
    controller = new DidController(didService as unknown as DidService);
  });

  const uid = '00000000-0000-4000-8000-000000000001';

  it('register delegates to service', async () => {
    const dto = { method: 'key' as const };
    didService.registerDID.mockResolvedValue({ id: 'd' } as any);
    await expect(controller.register(uid, dto as any)).resolves.toEqual({ id: 'd' });
    expect(didService.registerDID).toHaveBeenCalledWith(uid, dto);
  });

  it('resolve requires did query', () => {
    expect(() => controller.resolve('')).toThrow(BadRequestException);
    expect(() => controller.resolve('   ')).toThrow(BadRequestException);
  });

  it('resolve trims and delegates', async () => {
    didService.resolveDID.mockResolvedValue({ id: 'x' });
    await expect(controller.resolve('  did:x:y  ')).resolves.toEqual({ id: 'x' });
    expect(didService.resolveDID).toHaveBeenCalledWith('did:x:y');
  });

  it('updateDocument requires did in body', () => {
    expect(() => controller.updateDocument(uid, { did: '', didDocument: { id: 'x' } } as any)).toThrow(
      BadRequestException,
    );
  });

  it('updateDocument delegates', async () => {
    const dto = { did: 'did:key:1', didDocument: { id: 'did:key:1' } };
    didService.updateDIDDocument.mockResolvedValue({ id: 'r' } as any);
    await expect(controller.updateDocument(uid, dto as any)).resolves.toEqual({ id: 'r' });
    expect(didService.updateDIDDocument).toHaveBeenCalledWith(uid, 'did:key:1', dto);
  });

  it('getMine, issue, list, delete, verify, revoke, link, publicCredentials delegate', async () => {
    didService.getDIDByUser.mockResolvedValue([]);
    await controller.getMine(uid);
    expect(didService.getDIDByUser).toHaveBeenCalledWith(uid);

    const issueDto = { didId: 'd', credentialType: 't', issuer: 'i', credentialSubject: {}, issuedAt: 't', proof: {} };
    await controller.issue(uid, issueDto as any);
    expect(didService.issueCredential).toHaveBeenCalledWith(uid, issueDto);

    await controller.listCredentials(uid);
    expect(didService.listCredentials).toHaveBeenCalledWith(uid);

    await controller.deleteCredential(uid, '00000000-0000-4000-8000-000000000002');
    expect(didService.deleteCredential).toHaveBeenCalledWith(uid, '00000000-0000-4000-8000-000000000002');

    const vDto = { credentialId: 'c' };
    await controller.verify(vDto as any);
    expect(didService.verifyCredential).toHaveBeenCalledWith(vDto);

    await controller.revoke(uid, '00000000-0000-4000-8000-000000000003');
    expect(didService.revokeCredential).toHaveBeenCalledWith(uid, '00000000-0000-4000-8000-000000000003');

    const linkDto = { credentialId: 'c', didId: 'd' };
    await controller.link(uid, linkDto as any);
    expect(didService.linkCredential).toHaveBeenCalledWith(uid, linkDto);

    didService.getPublicProfileCredentials.mockResolvedValue([]);
    await controller.publicCredentials(uid);
    expect(didService.getPublicProfileCredentials).toHaveBeenCalledWith(uid);
  });
});
