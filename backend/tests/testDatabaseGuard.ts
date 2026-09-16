export function getDatabaseName(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

export function isAllowedTestDatabase(databaseUrl: string) {
  const databaseName = getDatabaseName(databaseUrl);
  return databaseName === 'incident_project_test' || databaseName.endsWith('_test');
}

export function assertSafeTestDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl || !isAllowedTestDatabase(databaseUrl)) {
    throw new Error('Refusing to run tests unless the DATABASE_URL database name is incident_project_test or ends with _test');
  }
}
