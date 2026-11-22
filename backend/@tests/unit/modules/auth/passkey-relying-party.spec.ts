import { ServiceUnavailableException } from '@nestjs/common';
import { relyingParty } from '@/modules/auth/passkeys/passkey-relying-party';

describe('relyingParty', () => {
  it('takes the RP ID and origin from APP_URL', () => {
    expect(relyingParty({ APP_URL: 'https://budget.example.co.il/app/' })).toMatchObject({
      id: 'budget.example.co.il',
      origins: ['https://budget.example.co.il'],
    });
  });

  it('falls back to FRONTEND_URL when APP_URL is not set', () => {
    expect(relyingParty({ FRONTEND_URL: 'http://localhost:3000' })).toMatchObject({
      id: 'localhost',
      origins: ['http://localhost:3000'],
    });
  });

  it('accepts FRONTEND_URL as a second origin only on the same host or below it', () => {
    expect(
      relyingParty({
        APP_URL: 'https://example.co.il',
        FRONTEND_URL: 'https://app.example.co.il',
      }).origins,
    ).toEqual(['https://example.co.il', 'https://app.example.co.il']);
    expect(
      relyingParty({
        APP_URL: 'https://example.co.il',
        FRONTEND_URL: 'https://example.co.il.evil.example.com',
      }).origins,
    ).toEqual(['https://example.co.il']);
  });

  it('refuses to work without a configured address', () => {
    expect(() => relyingParty({})).toThrow(ServiceUnavailableException);
    expect(() => relyingParty({ APP_URL: 'not a url' })).toThrow(ServiceUnavailableException);
  });
});
