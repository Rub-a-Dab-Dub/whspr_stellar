import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IsAdmin } from './is-admin.decorator';
import { IsAdminGuard } from '../guards/is-admin.guard';

describe('IsAdmin decorator', () => {
  it('attaches IsAdminGuard metadata to method', () => {
    class TestController {
      @IsAdmin()
      handler() {
        return true;
      }
    }

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TestController.prototype.handler,
    );

    expect(guards).toHaveLength(1);
    expect(guards[0]).toBe(IsAdminGuard);
  });
});
