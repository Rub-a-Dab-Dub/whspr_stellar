import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Clean up test data
    if (dataSource) {
      const userRepository = dataSource.getRepository(User);
      await userRepository.delete({});
    }
    await app.close();
  });

  describe('POST /users', () => {
    it('should create a new user with all fields', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          username: 'testuser',
          email: 'test@example.com',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          bio: 'Test bio',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.username).toBe('testuser');
          expect(res.body.walletAddress).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb');
          expect(res.body.email).toBe('test@example.com');
          expect(res.body.tier).toBe('free');
          expect(res.body.isActive).toBe(true);
          expect(res.body.isVerified).toBe(false);
          createdUserId = res.body.id;
        });
    });

    it('should create a user with only wallet address', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.walletAddress).toBe('0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199');
          expect(res.body.username).toBeNull();
          expect(res.body.email).toBeNull();
        });
    });

    it('should return 400 for invalid wallet address', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: 'invalid-address',
        })
        .expect(400);
    });

    it('should return 400 for invalid username format', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567890',
          username: 'invalid username!',
        })
        .expect(400);
    });

    it('should return 400 for username too short', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567891',
          username: 'ab',
        })
        .expect(400);
    });

    it('should return 409 for duplicate wallet address', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          username: 'anotheruser',
        })
        .expect(409);
    });

    it('should return 409 for duplicate username', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567892',
          username: 'testuser',
        })
        .expect(409);
    });

    it('should return 409 for duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567893',
          email: 'test@example.com',
        })
        .expect(409);
    });
  });

  describe('GET /users', () => {
    it('should return paginated list of users', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toHaveProperty('page');
          expect(res.body.meta).toHaveProperty('limit');
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('totalPages');
        });
    });

    it('should respect pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/users?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
          expect(res.body.data.length).toBeLessThanOrEqual(5);
        });
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id', () => {
      return request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdUserId);
          expect(res.body).toHaveProperty('username');
          expect(res.body).toHaveProperty('walletAddress');
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/api/users/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer()).get('/api/users/invalid-uuid').expect(400);
    });
  });

  describe('GET /users/username/:username', () => {
    it('should return user by username', () => {
      return request(app.getHttpServer())
        .get('/api/users/username/testuser')
        .expect(200)
        .expect((res) => {
          expect(res.body.username).toBe('testuser');
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should return 404 for non-existent username', () => {
      return request(app.getHttpServer()).get('/api/users/username/nonexistentuser').expect(404);
    });
  });

  describe('GET /users/wallet/:walletAddress', () => {
    it('should return user by wallet address', () => {
      return request(app.getHttpServer())
        .get('/api/users/wallet/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')
        .expect(200)
        .expect((res) => {
          expect(res.body.walletAddress).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb');
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should return 404 for non-existent wallet address', () => {
      return request(app.getHttpServer())
        .get('/api/users/wallet/0x0000000000000000000000000000000000000000')
        .expect(404);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update user profile', () => {
      return request(app.getHttpServer())
        .patch(`/api/users/me?userId=${createdUserId}`)
        .send({
          displayName: 'Updated Name',
          bio: 'Updated bio',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.displayName).toBe('Updated Name');
          expect(res.body.bio).toBe('Updated bio');
        });
    });

    it('should update username', () => {
      return request(app.getHttpServer())
        .patch(`/api/users/me?userId=${createdUserId}`)
        .send({
          username: 'updatedusername',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.username).toBe('updatedusername');
        });
    });

    it('should return 400 for invalid data', () => {
      return request(app.getHttpServer())
        .patch(`/api/users/me?userId=${createdUserId}`)
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .patch('/api/users/me?userId=123e4567-e89b-12d3-a456-426614174999')
        .send({
          displayName: 'Test',
        })
        .expect(404);
    });

    it('should return 409 when updating to existing username', async () => {
      // Create another user
      const response = await request(app.getHttpServer()).post('/api/users').send({
        walletAddress: '0x1234567890123456789012345678901234567894',
        username: 'anotheruser',
      });

      const anotherUserId = response.body.id;

      // Try to update to existing username
      return request(app.getHttpServer())
        .patch(`/api/users/me?userId=${anotherUserId}`)
        .send({
          username: 'updatedusername',
        })
        .expect(409);
    });
  });

  describe('DELETE /users/me', () => {
    it('should deactivate user (soft delete)', async () => {
      // Create a user to deactivate
      const createResponse = await request(app.getHttpServer()).post('/api/users').send({
        walletAddress: '0x1234567890123456789012345678901234567895',
        username: 'userToDelete',
      });

      const userToDeleteId = createResponse.body.id;

      // Deactivate the user
      await request(app.getHttpServer())
        .delete(`/api/users/me?userId=${userToDeleteId}`)
        .expect(204);

      // Verify user is deactivated but still exists
      const userRepository = dataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userToDeleteId } });

      expect(user).toBeDefined();
      expect(user?.isActive).toBe(false);
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .delete('/api/users/me?userId=123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('should return 400 when trying to deactivate already deactivated user', async () => {
      // Create a user
      const createResponse = await request(app.getHttpServer()).post('/api/users').send({
        walletAddress: '0x1234567890123456789012345678901234567896',
      });

      const userId = createResponse.body.id;

      // Deactivate once
      await request(app.getHttpServer()).delete(`/api/users/me?userId=${userId}`).expect(204);

      // Try to deactivate again
      return request(app.getHttpServer()).delete(`/api/users/me?userId=${userId}`).expect(400);
    });
  });
});
