import { User } from './user.entity';
import { UserRole } from '../../roles/entities/role.entity';

describe('User Entity', () => {
  it('should create a user instance with default role', () => {
    const user = new User();
    expect(user.role).toBe(UserRole.USER);
  });

  it('should allow setting different roles', () => {
    const user = new User();
    
    user.role = UserRole.ADMIN;
    expect(user.role).toBe(UserRole.ADMIN);
    
    user.role = UserRole.SUPER_ADMIN;
    expect(user.role).toBe(UserRole.SUPER_ADMIN);
    
    user.role = UserRole.MODERATOR;
    expect(user.role).toBe(UserRole.MODERATOR);
  });
});
