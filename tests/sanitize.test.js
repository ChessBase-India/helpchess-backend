const {
  FIELD_LIMITS,
  sanitizeString,
  sanitizeDonorFields,
  sanitizeEmail
} = require('utils/sanitize');

describe('sanitize', () => {
  it('auto-truncates public-facing fields instead of rejecting them', () => {
    const name = `A${'x'.repeat(FIELD_LIMITS.name + 50)}`;
    const email = `${'long'.repeat(80)}@example.com`;
    const address = 'addr-'.repeat(200);

    const sanitized = sanitizeDonorFields({ name, email, address });

    expect(sanitized.name).toHaveLength(FIELD_LIMITS.name);
    expect(sanitized.email.length).toBeLessThanOrEqual(FIELD_LIMITS.email);
    expect(sanitized.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(sanitized.address.length).toBeLessThanOrEqual(FIELD_LIMITS.address);
  });

  it('truncates a long email without breaking local/domain', () => {
    const email = `${'a'.repeat(300)}@example.com`;
    const truncated = sanitizeEmail(email);

    expect(truncated.length).toBeLessThanOrEqual(FIELD_LIMITS.email);
    expect(truncated.endsWith('@example.com')).toBe(true);
    expect(truncated).toMatch(/^[^\s@]+@example\.com$/);
  });

  it('trims after slicing as specified', () => {
    expect(sanitizeString(`  hello${' '.repeat(10)}`, 7)).toBe('hello');
  });
});
