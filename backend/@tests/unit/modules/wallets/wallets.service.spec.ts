import { createRepoMock } from '../../../helpers/create-repo-mock';
import { Statement } from '@/entities/statement.entity';
import { Transaction } from '@/entities/transaction.entity';
import { Wallet } from '@/entities/wallet.entity';
import { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';
import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { WalletsService } from '@/modules/wallets/wallets.service';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

describe('WalletsService', () => {
  let testingModule: TestingModule;
  let service: WalletsService;
  let walletRepository: Repository<Wallet>;

  const mockWallet: Partial<Wallet> = {
    id: 'wallet-1',
    name: 'Personal Card',
    currency: 'KZT',
    initialBalance: 10000,
    userId: '1',
    workspaceId: 'ws-1',
    isActive: true,
    bankName: 'Kaspi Bank',
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: createRepoMock<Wallet>(),
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { ...createRepoMock<WorkspaceMember>(), exists: vi.fn(async () => true) },
        },
        { provide: getRepositoryToken(Transaction), useValue: createRepoMock<Transaction>() },
        { provide: getRepositoryToken(Statement), useValue: createRepoMock<Statement>() },
        { provide: ExchangeRatesService, useValue: { getRateOrNull: vi.fn(async () => null) } },
        workspaceCurrencyProvider('EUR'),
      ],
    }).compile();

    service = testingModule.get<WalletsService>(WalletsService);
    walletRepository = testingModule.get<Repository<Wallet>>(getRepositoryToken(Wallet));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Wallet',
      currency: 'USD',
      initialBalance: 5000,
      bankName: 'Bereke Bank',
    };

    it('should create a new wallet', async () => {
      vi.spyOn(walletRepository, 'create').mockReturnValue(mockWallet as Wallet);
      vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      const result = await service.create('ws-1', 'user-1', createDto);

      expect(result).toEqual(mockWallet);
      expect(walletRepository.save).toHaveBeenCalled();
      expect(walletRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-1' }),
      );
    });

    it("falls back to the workspace's currency", async () => {
      const dtoWithoutCurrency = {
        name: 'Wallet',
      };

      const createSpy = vi
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', dtoWithoutCurrency);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
        }),
      );
    });

    it('should set default initial balance to 0', async () => {
      const dtoWithoutBalance = {
        name: 'Wallet',
      };

      const createSpy = vi
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', dtoWithoutBalance);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalance: 0,
        }),
      );
    });

    it('should set isActive to true by default', async () => {
      const createSpy = vi
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        }),
      );
    });

    it('should associate wallet with workspace', async () => {
      const createSpy = vi
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
        }),
      );
    });

    it('should support multiple currencies', async () => {
      const currencies = ['KZT', 'USD', 'EUR', 'RUB'];

      for (const currency of currencies) {
        const dto = { ...createDto, currency };
        const createSpy = vi
          .spyOn(walletRepository, 'create')
          .mockReturnValue(mockWallet as Wallet);
        vi.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

        await service.create('ws-1', 'user-1', dto);

        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currency,
          }),
        );
      }
    });
  });

  describe('findAll', () => {
    it('should return all wallets for workspace', async () => {
      const wallets = [mockWallet, { ...mockWallet, id: 'wallet-2' }];
      vi.spyOn(walletRepository, 'find').mockResolvedValue(wallets as Wallet[]);

      const result = await service.findAll('ws-1');

      expect(result).toHaveLength(2);
      expect(walletRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-1' },
        }),
      );
    });

    it('should order wallets by name', async () => {
      const findSpy = vi
        .spyOn(walletRepository, 'find')
        .mockResolvedValue([mockWallet] as Wallet[]);

      await service.findAll('ws-1');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { name: 'ASC' },
        }),
      );
    });

    it('should return empty array if no wallets', async () => {
      vi.spyOn(walletRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll('ws-1');

      expect(result).toEqual([]);
    });

    it('should include inactive wallets', async () => {
      const inactiveWallet = { ...mockWallet, isActive: false };
      vi.spyOn(walletRepository, 'find').mockResolvedValue([inactiveWallet] as Wallet[]);

      const result = await service.findAll('ws-1');

      expect(result.some(w => !w.isActive)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return wallet by id', async () => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(mockWallet as Wallet);

      const result = await service.findOne('wallet-1', 'ws-1');

      expect(result).toEqual(mockWallet);
    });

    it('should throw NotFoundException if not found', async () => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership', async () => {
      const findOneSpy = vi
        .spyOn(walletRepository, 'findOne')
        .mockResolvedValue(mockWallet as Wallet);

      await service.findOne('wallet-1', 'ws-1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wallet-1', workspaceId: 'ws-1' },
        }),
      );
    });

    it('should not return other workspace wallets', async () => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('wallet-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Wallet',
      initialBalance: 15000,
    };

    /**
     * The update runs in a transaction on a locked row: the transaction's
     * repository reads the row `FOR UPDATE`, writes only the named columns and
     * reads the row back. `stored` stands in for the row in the database.
     */
    let stored: Wallet | null;
    let locked: {
      findOne: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findOneByOrFail: ReturnType<typeof vi.fn>;
      metadata: { findColumnWithPropertyName: () => undefined };
    };

    beforeEach(() => {
      stored = { ...mockWallet, type: 'checking', creditLimit: null } as Wallet;
      locked = {
        findOne: vi.fn(async () => (stored ? { ...stored } : null)),
        update: vi.fn(async (_where: unknown, columns: Partial<Wallet>) => {
          stored = { ...(stored as Wallet), ...columns };
        }),
        findOneByOrFail: vi.fn(async () => ({ ...(stored as Wallet) })),
        metadata: { findColumnWithPropertyName: () => undefined },
      };
      Object.assign(walletRepository, {
        manager: {
          transaction: vi.fn(async (work: (manager: unknown) => unknown) =>
            work({ getRepository: () => locked }),
          ),
        },
      });
    });

    it('should update wallet', async () => {
      const result = await service.update('wallet-1', 'ws-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.initialBalance).toBe(updateDto.initialBalance);
      expect(locked.update).toHaveBeenCalledWith(
        { id: 'wallet-1', workspaceId: 'ws-1' },
        expect.objectContaining(updateDto),
      );
    });

    it('reads the row under a lock, within its workspace', async () => {
      await service.update('wallet-1', 'ws-1', updateDto);

      expect(walletRepository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(locked.findOne).toHaveBeenCalledWith({
        where: { id: 'wallet-1', workspaceId: 'ws-1' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('should throw NotFoundException if wallet not found', async () => {
      stored = null;

      await expect(service.update('invalid', 'ws-1', updateDto)).rejects.toThrow(NotFoundException);
      expect(locked.update).not.toHaveBeenCalled();
    });

    it('should preserve workspaceId on update', async () => {
      const result = await service.update('wallet-1', 'ws-1', updateDto);

      const [where, columns] = locked.update.mock.calls[0];
      expect(where).toEqual({ id: 'wallet-1', workspaceId: 'ws-1' });
      expect(columns).not.toHaveProperty('workspaceId');
      expect(result.workspaceId).toBe('ws-1');
    });

    it('should allow partial updates', async () => {
      const partialUpdate = { name: 'New Name Only' };

      const result = await service.update('wallet-1', 'ws-1', partialUpdate);

      // Only the named column, plus the limit an account that is not a card never holds.
      expect(locked.update).toHaveBeenCalledWith(
        { id: 'wallet-1', workspaceId: 'ws-1' },
        { name: 'New Name Only', creditLimit: null },
      );
      expect(result).toMatchObject({
        name: 'New Name Only',
        currency: mockWallet.currency,
        bankName: mockWallet.bankName,
        initialBalance: mockWallet.initialBalance,
      });
    });

    it('should allow toggling isActive status', async () => {
      const toggleDto = { isActive: false };

      const result = await service.update('wallet-1', 'ws-1', toggleDto);

      expect(result.isActive).toBe(false);
    });

    it('should update currency', async () => {
      const currencyUpdate = { currency: 'USD' };

      const result = await service.update('wallet-1', 'ws-1', currencyUpdate);

      expect(result.currency).toBe('USD');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(mockWallet as Wallet);
    });

    it('should delete wallet', async () => {
      const removeSpy = vi
        .spyOn(walletRepository, 'remove')
        .mockResolvedValue(mockWallet as Wallet);

      await service.remove('wallet-1', 'ws-1');

      expect(removeSpy).toHaveBeenCalledWith(mockWallet);
    });

    it('should throw NotFoundException if wallet not found', async () => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership before delete', async () => {
      vi.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('wallet-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });

    it('should handle wallets with transactions', async () => {
      // Should prevent deletion or cascade
      vi.spyOn(walletRepository, 'remove').mockResolvedValue(mockWallet as Wallet);

      await service.remove('wallet-1', 'ws-1');

      expect(walletRepository.remove).toHaveBeenCalled();
    });
  });
});
