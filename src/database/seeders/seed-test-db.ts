import { DataSource, Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

// Import entities
import { User } from '../../user/entities/user.entity';
import { UserProfile } from '../../user/entities/user-profile.entity';
import { Room } from '../../room/entities/room.entity';
import {
  RoomMember,
  MemberStatus,
  MemberRole,
} from '../../room/entities/room-member.entity';
import { Message } from '../../message/entities/message.entity';
import {
  Transfer,
  TransferStatus,
  TransferType,
} from '../../transfer/entities/transfer.entity';
import { RoomType } from '../../room/entities/room.entity';
import { MessageType } from '../../message/enums/message-type.enum';
import { UserRole } from '../../roles/entities/role.entity';

/**
 * Seeds the test database with realistic data for e2e tests.
 * This script is idempotent - it can be safely re-run.
 */
export async function seedTestDatabase(dataSource: DataSource) {
  console.log('🌱 Starting test database seed...');

  const userRepository = dataSource.getRepository(User);
  const roomRepository = dataSource.getRepository(Room);
  const roomMemberRepository = dataSource.getRepository(RoomMember);
  const messageRepository = dataSource.getRepository(Message);
  const transferRepository = dataSource.getRepository(Transfer);

  // Clear all data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing test data...');
  await messageRepository.delete({});
  await roomMemberRepository.delete({});
  await transferRepository.delete({});
  await roomRepository.delete({});
  await userRepository.delete({});

  // ========================
  // 1. Create Admin Users
  // ========================
  console.log('👤 Creating admin accounts...');
  const superAdmin = userRepository.create({
    id: uuid(),
    email: 'superadmin@test.local',
    username: 'superadmin',
    password: await bcrypt.hash('Test@123456', 10),
    role: UserRole.SUPER_ADMIN,
    isEmailVerified: true,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    profile: {
      firstName: 'Super',
      lastName: 'Admin',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=superadmin',
    },
  });

  const admin = userRepository.create({
    id: uuid(),
    email: 'admin@test.local',
    username: 'admin',
    password: await bcrypt.hash('Test@123456', 10),
    role: UserRole.ADMIN,
    isEmailVerified: true,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
  });

  const moderator = userRepository.create({
    id: uuid(),
    email: 'moderator@test.local',
    username: 'moderator',
    password: await bcrypt.hash('Test@123456', 10),
    role: UserRole.MODERATOR,
    isEmailVerified: true,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    profile: {
      firstName: 'Moderator',
      lastName: 'User',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=moderator',
    },
  });

  const adminUsers = [superAdmin, admin, moderator];
  await userRepository.save(adminUsers);
  console.log('✅ Created 3 admin accounts');

  // ========================
  // 2. Create Regular Users
  // ========================
  console.log('👥 Creating 100 regular users...');
  const userStates = [
    { status: 'active', count: 70 },
    { status: 'banned', count: 20 },
    { status: 'suspended', count: 10 },
  ];

  const users: User[] = [];
  let userIndex = 0;

  for (const state of userStates) {
    for (let i = 0; i < state.count; i++) {
      const user = userRepository.create({
        id: uuid(),
        email: `user${userIndex}@test.local`,
        username: `user${userIndex}`,
        password: await bcrypt.hash('Test@123456', 10),
        role: UserRole.USER,
        isEmailVerified: Math.random() > 0.2,
        isBanned: state.status === 'banned',
        isSuspended: state.status === 'suspended',
        walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
        profile: {
          firstName: `User`,
          lastName: `${userIndex}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${userIndex}`,
          bio: Math.random() > 0.5 ? `I'm user ${userIndex}` : null,
        },
        createdAt: new Date(
          Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
        ), // Last 90 days
      });
      users.push(user);
      userIndex++;
    }
  }

  await userRepository.save(users);
  console.log('✅ Created 100 regular users');

  const allUsers = [...adminUsers, ...users];

  // ========================
  // 3. Create Rooms
  // ========================
  console.log('🏠 Creating 50 rooms...');
  const roomTypes = [
    { type: RoomType.PUBLIC, count: 20 },
    { type: RoomType.PRIVATE, count: 15 },
    { type: RoomType.TOKEN_GATED, count: 10 },
    { type: RoomType.TIMED, count: 5 },
  ];

  const rooms: Room[] = [];
  let roomIndex = 0;

  for (const roomType of roomTypes) {
    for (let i = 0; i < roomType.count; i++) {
      const owner = allUsers[Math.floor(Math.random() * allUsers.length)];
      const room = roomRepository.create({
        id: uuid(),
        name: `Test Room ${roomIndex}`,
        description: `This is test room ${roomIndex} of type ${roomType.type}`,
        roomType: roomType.type,
        ownerId: owner.id,
        owner: owner,
        creatorId: owner.id,
        creator: owner,
        isPrivate: [RoomType.PRIVATE, RoomType.TOKEN_GATED].includes(
          roomType.type,
        ),
        isActive: Math.random() > 0.1, // 90% active, 10% inactive
        maxMembers: 50 + Math.floor(Math.random() * 150),
        memberCount: 0,
        isTokenGated: roomType.type === RoomType.TOKEN_GATED,
        entryFee:
          roomType.type === RoomType.TOKEN_GATED
            ? Math.random().toString()
            : '0',
        createdAt: new Date(
          Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
        ),
      });
      rooms.push(room);
      roomIndex++;
    }
  }

  await roomRepository.save(rooms);
  console.log('✅ Created 50 rooms');

  // ========================
  // 4. Create Room Members
  // ========================
  console.log('👫 Creating room members...');
  let memberCount = 0;

  for (const room of rooms) {
    // Add 5-30 members per room
    const memberCountPerRoom = 5 + Math.floor(Math.random() * 25);
    const shuffledUsers = allUsers.sort(() => Math.random() - 0.5);

    for (
      let i = 0;
      i < Math.min(memberCountPerRoom, shuffledUsers.length);
      i++
    ) {
      const user = shuffledUsers[i];
      const memberStatus =
        Math.random() > 0.8 ? MemberStatus.SUSPENDED : MemberStatus.ACTIVE;
      const memberRole =
        i === 0
          ? MemberRole.OWNER
          : i < 3
            ? Math.random() > 0.5
              ? MemberRole.ADMIN
              : MemberRole.MODERATOR
            : MemberRole.MEMBER;

      const member = roomMemberRepository.create({
        id: uuid(),
        roomId: room.id,
        room: room,
        userId: user.id,
        user: user,
        role: memberRole,
        status: memberStatus,
        joinedAt: new Date(
          Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
        ),
      });

      await roomMemberRepository.save(member);
      memberCount++;
    }
  }

  console.log(`✅ Created ${memberCount} room members`);

  // ========================
  // 5. Create Messages
  // ========================
  console.log('💬 Creating 500 messages...');
  const messageTexts = [
    'Hello everyone!',
    'This is a test message',
    'Great discussion!',
    'Thanks for sharing',
    'I agree with that',
    'Can someone help?',
    'Here is my example',
    'That makes sense',
    'Well put!',
    'Interesting perspective',
  ];

  const messages: Message[] = [];

  for (let i = 0; i < 500; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const author = allUsers[Math.floor(Math.random() * allUsers.length)];
    const messageType =
      Math.random() > 0.85
        ? MessageType.SYSTEM
        : Math.random() > 0.5
          ? MessageType.TEXT
          : MessageType.IMAGE;

    const message = messageRepository.create({
      id: uuid(),
      conversationId: room.id, // Using room ID as conversation ID for simplicity
      roomId: room.id,
      authorId: author.id,
      author: author,
      content:
        messageTexts[Math.floor(Math.random() * messageTexts.length)] +
        ` (#${i})`,
      originalContent: null,
      type: messageType,
      mediaUrl:
        messageType === MessageType.IMAGE
          ? `https://via.placeholder.com/300?text=Image${i}`
          : null,
      isEdited: Math.random() > 0.9,
      editedAt: Math.random() > 0.9 ? new Date() : null,
      isDeleted: Math.random() > 0.95,
      deletedAt: Math.random() > 0.95 ? new Date() : null,
      createdAt: new Date(
        Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
      ),
    });

    messages.push(message);
  }

  await messageRepository.save(messages);
  console.log('✅ Created 500 messages');

  // ========================
  // 6. Create Transactions
  // ========================
  console.log('💸 Creating 200 transactions...');
  const transactionTypes = [
    { type: TransferType.P2P, count: 150 },
    { type: TransferType.BULK, count: 50 },
  ];

  const statuses = [
    { status: TransferStatus.COMPLETED, weight: 0.8 },
    { status: TransferStatus.PENDING, weight: 0.12 },
    { status: TransferStatus.FAILED, weight: 0.08 },
  ];

  let transactionIndex = 0;

  for (const txType of transactionTypes) {
    for (let i = 0; i < txType.count; i++) {
      const sender = allUsers[Math.floor(Math.random() * allUsers.length)];
      const recipient = allUsers[Math.floor(Math.random() * allUsers.length)];

      if (sender.id === recipient.id) continue;

      // Determine status
      let status = TransferStatus.COMPLETED;
      const rand = Math.random();
      let cumulative = 0;
      for (const s of statuses) {
        cumulative += s.weight;
        if (rand < cumulative) {
          status = s.status;
          break;
        }
      }

      const transfer = transferRepository.create({
        id: uuid(),
        senderId: sender.id,
        sender: sender,
        recipientId: recipient.id,
        recipient: recipient,
        amount: (Math.random() * 1000).toFixed(8),
        blockchainNetwork: 'stellar',
        status: status,
        type: txType.type,
        transactionHash:
          status === TransferStatus.COMPLETED
            ? `0x${Math.random().toString(16).substr(2, 64)}`
            : null,
        memo: `Test transfer ${transactionIndex}`,
        senderBalanceBefore: (Math.random() * 10000).toFixed(8),
        senderBalanceAfter: (Math.random() * 10000).toFixed(8),
        recipientBalanceBefore: (Math.random() * 10000).toFixed(8),
        recipientBalanceAfter: (Math.random() * 10000).toFixed(8),
        completedAt: status === TransferStatus.COMPLETED ? new Date() : null,
        failureReason:
          status === TransferStatus.FAILED ? 'Insufficient balance' : null,
        retryCount: 0,
        createdAt: new Date(
          Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
        ),
      });

      await transferRepository.save(transfer);
      transactionIndex++;
    }
  }

  console.log('✅ Created 200 transactions');

  console.log('\n✨ Test database seed completed successfully!');
  console.log('📊 Summary:');
  console.log('   - 3 admin accounts (SUPER_ADMIN, ADMIN, MODERATOR)');
  console.log('   - 100 regular users (70 active, 20 banned, 10 suspended)');
  console.log('   - 50 rooms (20 PUBLIC, 15 PRIVATE, 10 TOKEN_GATED, 5 TIMED)');
  console.log(`   - ${memberCount} room memberships`);
  console.log('   - 500 messages');
  console.log('   - 200 transactions (150 P2P, 50 BULK)');
}

/**
 * Main execution - runs when called directly
 */
async function main() {
  const testDatabaseName = process.env.DATABASE_NAME_TEST || 'gasless_test';
  const dbConfig = {
    type: 'postgres' as const,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: testDatabaseName,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false,
  };

  const dataSource = new DataSource(dbConfig as any);

  try {
    await dataSource.initialize();
    console.log('✅ Connected to test database');
    await seedTestDatabase(dataSource);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
