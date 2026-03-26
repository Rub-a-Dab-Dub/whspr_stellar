import { SorobanService } from './soroban.service';

describe('SorobanService', () => {
  it('submits hash asynchronously', async () => {
    const service = new SorobanService();
    await expect(service.submitMessageHash('id', 'content')).resolves.toBeUndefined();
  });
});
