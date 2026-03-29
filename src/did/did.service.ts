import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DidRecord } from './entities/did-record.entity';
import { VerifiableCredential } from './entities/verifiable-credential.entity';
import { RegisterDidDto } from './dto/register-did.dto';
import { UpdateDidDocumentDto } from './dto/update-did-document.dto';
import { IssueCredentialDto } from './dto/issue-credential.dto';
import { LinkCredentialDto } from './dto/link-credential.dto';
import { VerifyCredentialDto } from './dto/verify-credential.dto';
import {
  buildMinimalDidDocument,
  buildStellarDid,
  isValidStellarPublicKey,
} from './utils/stellar-did.util';
import { verifyCredentialProof } from './utils/vc-crypto.util';

@Injectable()
export class DidService {
  constructor(
    @InjectRepository(DidRecord)
    private readonly didRepo: Repository<DidRecord>,
    @InjectRepository(VerifiableCredential)
    private readonly vcRepo: Repository<VerifiableCredential>,
  ) {}

  async registerDID(userId: string, dto: RegisterDidDto): Promise<DidRecord> {
    if (dto.method === 'stellar') {
      const pk = dto.stellarPublicKey?.trim();
      if (!pk || !isValidStellarPublicKey(pk)) {
        throw new BadRequestException('stellarPublicKey must be a valid Stellar G-address');
      }
      const network = dto.stellarNetwork?.trim() || 'testnet';
      const did = buildStellarDid(pk, network);
      const existing = await this.didRepo.findOne({ where: { did } });
      if (existing) {
        throw new BadRequestException('DID already registered');
      }
      const baseDoc = buildMinimalDidDocument(did, pk);
      const didDocument = dto.didDocument
        ? { ...baseDoc, ...dto.didDocument, id: did }
        : baseDoc;
      const row = this.didRepo.create({
        userId,
        did,
        didDocument,
        method: 'stellar',
        isVerified: true,
      });
      return this.didRepo.save(row);
    }

    if (dto.method === 'key' || dto.method === 'web') {
      const did = `did:${dto.method}:${randomUUID()}`;
      const baseDoc = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        ...(dto.didDocument ?? {}),
      };
      const row = this.didRepo.create({
        userId,
        did,
        didDocument: baseDoc,
        method: dto.method,
        isVerified: false,
      });
      return this.didRepo.save(row);
    }

    throw new BadRequestException('Unsupported DID method');
  }

  async resolveDID(did: string): Promise<Record<string, unknown>> {
    const row = await this.didRepo.findOne({ where: { did } });
    if (!row) {
      throw new NotFoundException('DID not found');
    }
    return row.didDocument as Record<string, unknown>;
  }

  async updateDIDDocument(
    userId: string,
    did: string,
    dto: UpdateDidDocumentDto,
  ): Promise<DidRecord> {
    const row = await this.didRepo.findOne({ where: { did } });
    if (!row) {
      throw new NotFoundException('DID not found');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Not your DID');
    }
    const doc = dto.didDocument;
    if (doc.id !== did && doc.id !== row.did) {
      throw new BadRequestException('didDocument.id must match the DID');
    }
    row.didDocument = { ...doc, id: did };
    return this.didRepo.save(row);
  }

  async issueCredential(userId: string, dto: IssueCredentialDto): Promise<VerifiableCredential> {
    const didRow = await this.didRepo.findOne({ where: { id: dto.didId, userId } });
    if (!didRow) {
      throw new NotFoundException('DID not found for user');
    }

    const issuerRow = await this.didRepo.findOne({ where: { did: dto.issuer } });
    if (!issuerRow) {
      throw new BadRequestException('Issuer DID is not registered in this network');
    }

    const verifyOnIssue = dto.verifyProof !== false;
    const credentialRecord: Record<string, unknown> = {
      credentialType: dto.credentialType,
      issuer: dto.issuer,
      credentialSubject: dto.credentialSubject,
      issuedAt: dto.issuedAt,
      ...(dto.expiresAt ? { expiresAt: dto.expiresAt } : {}),
      proof: dto.proof,
    };

    if (verifyOnIssue) {
      const ok = verifyCredentialProof(
        credentialRecord,
        dto.issuer,
        issuerRow.didDocument as Record<string, unknown>,
        issuerRow.method,
      );
      if (!ok) {
        throw new BadRequestException('Credential proof verification failed');
      }
    }

    const vc = this.vcRepo.create({
      userId,
      didId: dto.didId,
      credentialType: dto.credentialType,
      issuer: dto.issuer,
      credentialSubject: dto.credentialSubject,
      proof: dto.proof as unknown as Record<string, unknown>,
      issuedAt: new Date(dto.issuedAt),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      showOnProfile: dto.showOnProfile ?? false,
    });
    return this.vcRepo.save(vc);
  }

  async verifyCredential(
    dto: VerifyCredentialDto,
    userId?: string,
  ): Promise<{ valid: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    let credential: Record<string, unknown>;
    if (dto.credentialId) {
      const vc = await this.vcRepo.findOne({ where: { id: dto.credentialId } });
      if (!vc) {
        return { valid: false, reasons: ['credential_not_found'] };
      }
      if (userId && vc.userId !== userId) {
        return { valid: false, reasons: ['forbidden'] };
      }
      if (vc.isRevoked) {
        return { valid: false, reasons: ['revoked'] };
      }
      credential = {
        credentialType: vc.credentialType,
        issuer: vc.issuer,
        credentialSubject: vc.credentialSubject,
        issuedAt: vc.issuedAt.toISOString(),
        ...(vc.expiresAt ? { expiresAt: vc.expiresAt.toISOString() } : {}),
        proof: vc.proof,
      };
    } else if (dto.credential) {
      const c = dto.credential;
      credential = {
        credentialType: c.credentialType,
        issuer: c.issuer,
        credentialSubject: c.credentialSubject,
        issuedAt: c.issuedAt,
        ...(c.expiresAt ? { expiresAt: c.expiresAt } : {}),
        proof: c.proof,
      };
    } else {
      throw new BadRequestException('Provide credentialId or credential');
    }

    const issuerRow = await this.didRepo.findOne({ where: { did: credential.issuer as string } });
    if (!issuerRow) {
      reasons.push('issuer_did_not_found');
      return { valid: false, reasons };
    }

    const exp = credential.expiresAt as string | undefined;
    if (exp && new Date(exp).getTime() < Date.now()) {
      reasons.push('expired');
      return { valid: false, reasons };
    }

    const cryptoOk = verifyCredentialProof(
      credential,
      credential.issuer as string,
      issuerRow.didDocument as Record<string, unknown>,
      issuerRow.method,
    );
    if (!cryptoOk) {
      reasons.push('invalid_proof');
      return { valid: false, reasons };
    }

    return { valid: true, reasons: [] };
  }

  async revokeCredential(userId: string, credentialId: string): Promise<VerifiableCredential> {
    const vc = await this.vcRepo.findOne({ where: { id: credentialId, userId } });
    if (!vc) {
      throw new NotFoundException('Credential not found');
    }
    vc.isRevoked = true;
    vc.revokedAt = new Date();
    return this.vcRepo.save(vc);
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const vc = await this.vcRepo.findOne({ where: { id: credentialId, userId } });
    if (!vc) {
      throw new NotFoundException('Credential not found');
    }
    await this.vcRepo.remove(vc);
  }

  async getDIDByUser(userId: string): Promise<DidRecord[]> {
    return this.didRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async listCredentials(userId: string): Promise<VerifiableCredential[]> {
    return this.vcRepo.find({
      where: { userId },
      order: { issuedAt: 'DESC' },
    });
  }

  async linkCredential(userId: string, dto: LinkCredentialDto): Promise<VerifiableCredential> {
    const vc = await this.vcRepo.findOne({ where: { id: dto.credentialId, userId } });
    if (!vc) {
      throw new NotFoundException('Credential not found');
    }
    const didRow = await this.didRepo.findOne({ where: { id: dto.didId, userId } });
    if (!didRow) {
      throw new NotFoundException('Target DID not found');
    }
    vc.didId = dto.didId;
    return this.vcRepo.save(vc);
  }

  async getPublicProfileCredentials(userId: string): Promise<VerifiableCredential[]> {
    return this.vcRepo.find({
      where: { userId, showOnProfile: true, isRevoked: false },
      order: { issuedAt: 'DESC' },
    });
  }
}
