// Универсальный парсер pool_peerIds для всех команд пулла
function safeParsePeerIds(pool_peerIds) {
  if (!pool_peerIds) return [];
  try {
    const arr = typeof pool_peerIds === 'string'
      ? JSON.parse(pool_peerIds)
      : pool_peerIds;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

module.exports = { safeParsePeerIds };
