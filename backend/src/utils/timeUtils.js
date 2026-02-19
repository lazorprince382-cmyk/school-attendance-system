function todayDateString(tz = 'Africa/Kampala') {
  const now = new Date();
  // For simplicity, use server local time; in production, consider a TZ-aware library.
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidScanTime(action) {
  // Departure only: only OUT is used; time window 14:00–18:00
  if (action !== 'OUT') return false;
  const now = new Date();
  const hour = now.getHours();
  return hour >= 14 && hour <= 18;
}

module.exports = {
  todayDateString,
  isValidScanTime,
};

