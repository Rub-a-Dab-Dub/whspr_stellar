
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  Injectable,
  Module,
  SetMetadata,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  PENDING = 'pending',
}

// Role hierarchy – higher index = more privileged
const ROLE_HIERARCHY = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  walletAddress: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ default: 0 })
  xp: number;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0, type: 'bigint' })
  totalTipsSent: number;

  @Column({ default: 0, type: 'bigint' })
  totalTipsReceived: number;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  lastActiveAt: Date;
}

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  actorId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Filter DTO ───────────────────────────────────────────────────────────────

export class UserFilterDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minXp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxXp?: number;

  @IsOptional()
  @IsString()
  joinedAfter?: string; // ISO date string

  @IsOptional()
  @IsString()
  joinedBefore?: string; // ISO date string

  @IsOptional()
  @IsString()
  lastActiveSince?: string; // ISO date string
}

// ─── Guards & Decorators ──────────────────────────────────────────────────────

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Minimal roles guard – replace with your actual guard if you have one.
 * Expects `request.user` to be set by an upstream JWT/session guard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<Request & { user?: { role: UserRole } }>();
    if (!user) return false;

    const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
    return requiredRoles.some((r) => userRoleIndex >= ROLE_HIERARCHY.indexOf(r));
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const MAX_EXPORT_ROWS = 10_000;

const CSV_COLUMNS: Array<{ header: string; key: keyof UserEntity }> = [
  { header: 'id', key: 'id' },
  { header: 'username', key: 'username' },
  { header: 'email', key: 'email' },
  { header: 'walletAddress', key: 'walletAddress' },
  { header: 'role', key: 'role' },
  { header: 'status', key: 'status' },
  { header: 'xp', key: 'xp' },
  { header: 'level', key: 'level' },
  { header: 'totalTipsSent', key: 'totalTipsSent' },
  { header: 'totalTipsReceived', key: 'totalTipsReceived' },
  { header: 'joinedAt', key: 'joinedAt' },
  { header: 'lastActiveAt', key: 'lastActiveAt' },
];

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value instanceof Date ? value.toISOString() : value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

@Injectable()
export class AdminUsersExportService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  private buildQuery(filters: UserFilterDto): SelectQueryBuilder<UserEntity> {
    const qb = this.userRepo.createQueryBuilder('u');

    if (filters.username) {
      qb.andWhere('u.username ILIKE :username', { username: `%${filters.username}%` });
    }
    if (filters.email) {
      qb.andWhere('u.email ILIKE :email', { email: `%${filters.email}%` });
    }
    if (filters.role) {
      qb.andWhere('u.role = :role', { role: filters.role });
    }
    if (filters.status) {
      qb.andWhere('u.status = :status', { status: filters.status });
    }
    if (filters.minXp !== undefined) {
      qb.andWhere('u.xp >= :minXp', { minXp: filters.minXp });
    }
    if (filters.maxXp !== undefined) {
      qb.andWhere('u.xp <= :maxXp', { maxXp: filters.maxXp });
    }
    if (filters.joinedAfter) {
      qb.andWhere('u.joinedAt >= :joinedAfter', { joinedAfter: new Date(filters.joinedAfter) });
    }
    if (filters.joinedBefore) {
      qb.andWhere('u.joinedAt <= :joinedBefore', { joinedBefore: new Date(filters.joinedBefore) });
    }
    if (filters.lastActiveSince) {
      qb.andWhere('u.lastActiveAt >= :lastActiveSince', {
        lastActiveSince: new Date(filters.lastActiveSince),
      });
    }

    return qb;
  }

  async streamCsvExport(
    filters: UserFilterDto,
    actorId: string,
    res: Response,
  ): Promise<void> {
    // 1. Count rows – reject if over limit
    const count = await this.buildQuery(filters).getCount();
    if (count > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export would return ${count} rows which exceeds the maximum of ${MAX_EXPORT_ROWS}. ` +
          `Please narrow your filters and try again.`,
      );
    }

    // 2. Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        action: 'ADMIN_USER_EXPORT',
        actorId,
        metadata: { filters, rowCount: count },
      }),
    );

    // 3. Set streaming headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${timestamp}.csv"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // 4. Write CSV header row
    res.write(CSV_COLUMNS.map((c) => c.header).join(',') + '\n');

    // 5. Stream rows in batches to avoid loading everything into memory
    const BATCH_SIZE = 500;
    let offset = 0;

    while (offset < count) {
      const rows = await this.buildQuery(filters)
        .orderBy('u.joinedAt', 'ASC')
        .skip(offset)
        .take(BATCH_SIZE)
        .getMany();

      if (rows.length === 0) break;

      const chunk = rows
        .map((row) => CSV_COLUMNS.map((c) => escapeCsvField(row[c.key])).join(','))
        .join('\n');

      res.write(chunk + '\n');
      offset += rows.length;
    }

    res.end();
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Admin – Users')
@Controller('admin/users')
@UseGuards(RolesGuard)
export class AdminUsersExportController {
  constructor(private readonly exportService: AdminUsersExportService) {}

  @Get('export')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export filtered users as a streamed CSV (max 10,000 rows)' })
  @ApiQuery({ name: 'username', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'minXp', required: false, type: Number })
  @ApiQuery({ name: 'maxXp', required: false, type: Number })
  @ApiQuery({ name: 'joinedAfter', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'joinedBefore', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'lastActiveSince', required: false, description: 'ISO date string' })
  @ApiResponse({ status: 200, description: 'CSV file stream' })
  @ApiResponse({ status: 400, description: 'Filter exceeds 10,000 row limit' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async exportUsers(
    @Query() filters: UserFilterDto,
    @Req() req: Request & { user?: { id: string; role: UserRole } },
    @Res() res: Response,
  ): Promise<void> {
    const actorId = req.user?.id ?? 'unknown';
    await this.exportService.streamCsvExport(filters, actorId, res);
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AuditLogEntity])],
  controllers: [AdminUsersExportController],
  providers: [AdminUsersExportService, RolesGuard],
  exports: [AdminUsersExportService],
})
export class AdminUsersExportModule {}

/**
 * ─── Integration ────────────────────────────────────────────────────────────
 *
 * In your AppModule (or AdminModule):
 *
 *   @Module({
 *     imports: [
 *       TypeOrmModule.forRoot({ ... }),   // your DB config
 *       AdminUsersExportModule,
 *     ],
 *   })
 *   export class AppModule {}
 *
 * ─── Example requests ────────────────────────────────────────────────────────
 *
 *   # All active users (fails if > 10k)
 *   GET /admin/users/export?status=active
 *
 *   # Admins who joined this year
 *   GET /admin/users/export?role=admin&joinedAfter=2025-01-01
 *
 *   # High-XP users
 *   GET /admin/users/export?minXp=5000
 *
 * ─── Notes ───────────────────────────────────────────────────────────────────
 *
 * • Rows are fetched in batches of 500 and streamed with Transfer-Encoding:
 *   chunked so the server never holds the full dataset in memory.
 *
 * • The RolesGuard here is minimal. If your app already has a guard, replace
 *   the `UseGuards(RolesGuard)` references with your existing guard and keep
 *   the `RequireRoles` decorator as-is (it uses the standard ROLES_KEY).
 *
 * • If you use a global JwtAuthGuard, remove it from the provider list here
 *   and just let the global guard populate req.user before this guard runs.
 */