import { describe, expect, it } from 'vitest';
import { getDatabaseName, isAllowedTestDatabase } from './testDatabaseGuard.js';

describe('test database guard', () => {
  it('checks the parsed database name, not arbitrary URL substrings', () => {
    expect(getDatabaseName('postgresql://test_user:test_password@localhost:5432/incident_dev?schema=public')).toBe('incident_dev');
    expect(isAllowedTestDatabase('postgresql://test_user:test_password@localhost:5432/incident_dev?schema=public')).toBe(false);
    expect(isAllowedTestDatabase('postgresql://app@localhost:5432/incident_project_test?schema=public')).toBe(true);
    expect(isAllowedTestDatabase('postgresql://app@localhost:5432/my_feature_test?schema=public')).toBe(true);
  });
});
