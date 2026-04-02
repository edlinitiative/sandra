/**
 * Tests for the multi-tenant permission system extensions.
 */

import { describe, it, expect } from 'vitest';
import { getScopesForRole, hasRequiredScopes, roleHasScope } from '@/lib/auth/permissions';

describe('Permission system — Google Workspace scopes', () => {
  it('guest has no Google scopes', () => {
    const scopes = getScopesForRole('guest');
    expect(scopes).not.toContain('drive:read');
    expect(scopes).not.toContain('gmail:send');
    expect(scopes).not.toContain('contacts:read');
  });

  it('student has drive:read and contacts:read', () => {
    const scopes = getScopesForRole('student');
    expect(scopes).toContain('drive:read');
    expect(scopes).toContain('contacts:read');
    expect(scopes).not.toContain('gmail:send');
    expect(scopes).not.toContain('gmail:draft');
  });

  it('educator has drive:read, contacts:read, and gmail:draft', () => {
    const scopes = getScopesForRole('educator');
    expect(scopes).toContain('drive:read');
    expect(scopes).toContain('contacts:read');
    expect(scopes).toContain('gmail:draft');
    expect(scopes).not.toContain('gmail:send');
  });

  it('admin has full Google Workspace scopes', () => {
    const scopes = getScopesForRole('admin');
    expect(scopes).toContain('drive:read');
    expect(scopes).toContain('drive:write');
    expect(scopes).toContain('contacts:read');
    expect(scopes).toContain('gmail:draft');
    expect(scopes).toContain('gmail:send');
  });

  it('hasRequiredScopes checks google scopes correctly', () => {
    const studentScopes = getScopesForRole('student');
    expect(hasRequiredScopes(studentScopes, ['drive:read'])).toBe(true);
    expect(hasRequiredScopes(studentScopes, ['gmail:send'])).toBe(false);
    expect(hasRequiredScopes(studentScopes, ['drive:read', 'contacts:read'])).toBe(true);
  });

  it('roleHasScope works for google scopes', () => {
    expect(roleHasScope('admin', 'gmail:send')).toBe(true);
    expect(roleHasScope('student', 'gmail:send')).toBe(false);
    expect(roleHasScope('educator', 'gmail:draft')).toBe(true);
  });
});
