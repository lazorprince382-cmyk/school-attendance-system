/**
 * Normalize Ugandan mobile numbers (Airtel, MTN) to E.164 for Africa's Talking.
 * Accepts: 0751234142, 256751234142, +256 751 234 142
 * Returns: 256751234142 or null if invalid/empty.
 */
function normalizeUgandaPhone(phone) {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 9 && digits.startsWith('7')) {
    return '256' + digits;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return '256' + digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('256')) {
    return digits;
  }
  return null;
}

module.exports = {
  normalizeUgandaPhone,
};
