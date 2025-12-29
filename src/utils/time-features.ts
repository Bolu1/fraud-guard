/**
 * Time features extracted from timestamp
 */
export interface TimeFeatures {
  hour: number; // 0-23
  month: number; // 1-12
  dayofweek: number; // 0-6 (0=Sunday)
  day: number; // 1-31
}

/**
 * Extract time features from timestamp
 * Uses local time (not UTC)
 */
export function extractTimeFeatures(timestamp: Date): TimeFeatures {
  return {
    hour: timestamp.getHours(), // 0-23 (local time)
    month: timestamp.getMonth() + 1, // 1-12 (JavaScript uses 0-11)
    dayofweek: timestamp.getDay(), // 0-6 (0=Sunday, 6=Saturday)
    day: timestamp.getDate(), // 1-31
  };
}

/**
 * Format time features for display
 */
export function formatTimeFeatures(features: TimeFeatures): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return `${days[features.dayofweek]}, ${months[features.month - 1]} ${features.day} at ${features.hour}:00`;
}