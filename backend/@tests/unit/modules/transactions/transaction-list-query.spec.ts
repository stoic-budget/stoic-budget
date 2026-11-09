import { BadRequestException } from '@nestjs/common';
import { EffectSchemaQueryPipe } from '../../../../src/common/effect/schema-query';
import { TransactionListQuery } from '../../../../src/contracts';

const tagOne = '7d0f3a52-1c4e-4b8a-9f00-2a6c1b9d4e11';
const tagTwo = '0b6e2f1c-8d3a-4c5e-9a7b-1f2e3d4c5b6a';

describe('GET /transactions search query', () => {
  const pipe = new EffectSchemaQueryPipe(TransactionListQuery, 'query');

  it('reads the text, amounts, lists and toggles as the filters expect', () => {
    expect(
      pipe.transform({
        q: 'ACME',
        amountMin: '10',
        amountMax: '99.5',
        tagIds: `${tagOne},${tagTwo}`,
        categoryIds: [tagOne],
        uncategorized: 'true',
        untagged: 'false',
        noPayee: 'true',
      }),
    ).toEqual({
      q: 'ACME',
      amountMin: 10,
      amountMax: 99.5,
      tagIds: [tagOne, tagTwo],
      categoryIds: [tagOne],
      uncategorized: true,
      untagged: false,
      noPayee: true,
    });
  });

  it.each([
    { tagIds: 'not-a-uuid' },
    { categoryIds: `${tagOne},42` },
    { amountMin: '-1' },
    { amountMax: 'lots' },
    { uncategorized: 'yes' },
    { q: 'x'.repeat(201) },
  ])('rejects %o before it reaches the database', input => {
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });
});
