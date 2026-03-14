import { roundMoney } from './pricing-rounding';

describe('roundMoney', () => {
  it('rounds using 2 decimals consistently', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(9.999)).toBe(10);
  });
});
