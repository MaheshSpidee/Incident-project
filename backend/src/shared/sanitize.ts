export function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/User `[^`]+` was denied access on the database `[^`]+`/g, 'Database access was denied')
    .replace(/role "[^"]+" does not exist/g, 'configured database role does not exist')
    .replace(/(postgresql:\/\/)[^\s]+/g, '$1<redacted>');
}
