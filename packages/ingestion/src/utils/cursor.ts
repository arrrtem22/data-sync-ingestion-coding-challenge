export const refreshCursor = (cursor: string): string => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    // Extend expiration by 1 hour
    decoded.exp = Date.now() + 3600000; 
    return Buffer.from(JSON.stringify(decoded)).toString('base64');
  } catch (e) {
    // If not parseable, return as is
    return cursor;
  }
};
