import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { LessThan, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { appError } from '../errors/app-error';

/** The hash of a key whose request is still running: no sha256 is this. */
const PENDING = 'pending';
/** A reservation left by a request that died is taken over after this. */
const PENDING_MINUTES = 5;

type JsonObject = Record<string, unknown>;

interface IdempotencyResponse {
  data: unknown;
  cached: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyKeyRepository: Repository<IdempotencyKey>,
  ) {}

  /**
   * Runs `work` once per key. The key is reserved before the work starts (the
   * table's unique key decides between two requests sent together), so a
   * repeat sent while the first still runs answers 409 instead of doing the
   * work twice; a repeat after it finished gets the first answer. If the work
   * fails, the key is released and the same request can be sent again.
   * Without a key the work simply runs.
   */
  async once<T>(
    key: string | null | undefined,
    userId: string,
    workspaceId: string,
    work: () => Promise<T>,
  ): Promise<{ data: T; cached: boolean }> {
    if (!key) {
      return { data: await work(), cached: false };
    }
    const cached = await this.reserve(key, userId, workspaceId);
    if (cached) {
      return { data: cached.data as T, cached: true };
    }
    let data: T;
    try {
      data = await work();
    } catch (error) {
      await this.idempotencyKeyRepository.delete({
        key,
        userId,
        workspaceId,
        responseHash: PENDING,
      });
      throw error;
    }
    await this.storeKey(key, userId, workspaceId, data);
    return { data, cached: false };
  }

  /** Takes the key for this request, or answers what an earlier one did with it. */
  private async reserve(
    key: string,
    userId: string,
    workspaceId: string,
  ): Promise<IdempotencyResponse | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const expiresAt = new Date(Date.now() + PENDING_MINUTES * 60_000);
      const inserted = await this.idempotencyKeyRepository
        .createQueryBuilder()
        .insert()
        .into(IdempotencyKey)
        .values({ key, userId, workspaceId, responseHash: PENDING, responseData: {}, expiresAt })
        .orIgnore()
        .returning(['id'])
        .execute();
      if ((inserted.raw as unknown[]).length > 0) {
        return null;
      }
      const existing = await this.idempotencyKeyRepository.findOne({
        where: { key, userId, workspaceId },
      });
      if (!existing) {
        continue;
      }
      // Expired, or left pending by a request that died: taken over.
      if (existing.expiresAt < new Date()) {
        // Matched by "already expired", not by the stored instant: a value with
        // microseconds would never equal its JS Date and stay stuck.
        await this.idempotencyKeyRepository.delete({
          id: existing.id,
          expiresAt: LessThan(new Date()),
        });
        continue;
      }
      if (existing.responseHash === PENDING) {
        throw new ConflictException(appError('REQUEST_IN_PROGRESS'));
      }
      return { data: existing.responseData, cached: true };
    }
    throw new ConflictException(appError('REQUEST_IN_PROGRESS'));
  }

  /**
   * Store an idempotency key with response data
   * @param key The idempotency key
   * @param userId User ID
   * @param workspaceId Workspace ID
   * @param response Response data to cache
   * @param ttlHours Time to live in hours (default: 24)
   */
  async storeKey(
    key: string,
    userId: string,
    workspaceId: string,
    response: unknown,
    ttlHours = 24,
  ): Promise<void> {
    const responseHash = this.hashResponse(response);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const responseData = (response ?? {}) as Record<string, unknown>;
    // Fills the reservation `once` made; a key stored without one is inserted.
    const filled = await this.idempotencyKeyRepository.update(
      { key, userId, workspaceId },
      { responseHash, responseData: responseData as QueryDeepPartialEntity<JsonObject>, expiresAt },
    );
    if (!filled.affected) {
      await this.idempotencyKeyRepository.save(
        this.idempotencyKeyRepository.create({
          key,
          userId,
          workspaceId,
          responseHash,
          responseData,
          expiresAt,
        }),
      );
    }
  }

  /**
   * Clean up expired idempotency keys
   * Should be called periodically by a cron job
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.idempotencyKeyRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Hash response data for integrity checking
   */
  private hashResponse(response: unknown): string {
    const data = JSON.stringify(response);
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
