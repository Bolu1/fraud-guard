import { TransactionCategory } from '../interfaces/types';

/**
 * Category mapping guide for common business types
 */
export const CATEGORY_GUIDE: Record<string, TransactionCategory> = {
  // E-commerce
  ecommerce: TransactionCategory.SHOPPING_NET,
  'digital-goods': TransactionCategory.SHOPPING_NET,
  'online-shopping': TransactionCategory.SHOPPING_NET,
  'physical-goods': TransactionCategory.SHOPPING_POS,
  retail: TransactionCategory.SHOPPING_POS,

  // SaaS & Software
  saas: TransactionCategory.MISC_NET,
  software: TransactionCategory.MISC_NET,
  subscription: TransactionCategory.MISC_NET,
  'cloud-services': TransactionCategory.MISC_NET,

  // Services
  'professional-services': TransactionCategory.MISC_NET,
  consulting: TransactionCategory.MISC_NET,
  'business-services': TransactionCategory.MISC_NET,

  // B2B
  wholesale: TransactionCategory.MISC_NET,
  'b2b-services': TransactionCategory.MISC_NET,

  // Food & Dining
  restaurant: TransactionCategory.FOOD_DINING,
  'food-delivery': TransactionCategory.FOOD_DINING,
  cafe: TransactionCategory.FOOD_DINING,

  // Travel
  hotel: TransactionCategory.TRAVEL,
  flight: TransactionCategory.TRAVEL,
  booking: TransactionCategory.TRAVEL,

  // Entertainment
  streaming: TransactionCategory.ENTERTAINMENT,
  gaming: TransactionCategory.ENTERTAINMENT,
  media: TransactionCategory.ENTERTAINMENT,

  // Groceries
  grocery: TransactionCategory.GROCERY_POS,
  'online-grocery': TransactionCategory.GROCERY_NET,

  // Gas & Transport
  gas: TransactionCategory.GAS_TRANSPORT,
  fuel: TransactionCategory.GAS_TRANSPORT,
  transport: TransactionCategory.GAS_TRANSPORT,
  rideshare: TransactionCategory.GAS_TRANSPORT,

  // Health & Fitness
  gym: TransactionCategory.HEALTH_FITNESS,
  healthcare: TransactionCategory.HEALTH_FITNESS,
  fitness: TransactionCategory.HEALTH_FITNESS,

  // Home
  furniture: TransactionCategory.HOME,
  'home-improvement': TransactionCategory.HOME,

  // Kids & Pets
  'pet-supplies': TransactionCategory.KIDS_PETS,
  toys: TransactionCategory.KIDS_PETS,

  // Personal Care
  'personal-care': TransactionCategory.PERSONAL_CARE,
  beauty: TransactionCategory.PERSONAL_CARE,
  salon: TransactionCategory.PERSONAL_CARE,

  // Default fallbacks
  default: TransactionCategory.MISC_NET,
  online: TransactionCategory.MISC_NET,
  'in-person': TransactionCategory.MISC_POS,
};

/**
 * Auto-map business type to transaction category
 * Returns a suggested category or default
 */
export function autoMapCategory(
  businessType?: string,
  merchantType?: string
): TransactionCategory {
  // Try business type first
  if (businessType) {
    const normalized = businessType.toLowerCase().replace(/\s+/g, '-');
    if (CATEGORY_GUIDE[normalized]) {
      return CATEGORY_GUIDE[normalized];
    }
  }

  // Try merchant type
  if (merchantType) {
    const normalized = merchantType.toLowerCase().replace(/\s+/g, '-');
    if (CATEGORY_GUIDE[normalized]) {
      return CATEGORY_GUIDE[normalized];
    }
  }

  // Default fallback
  return TransactionCategory.MISC_NET;
}

/**
 * Get category description for documentation
 */
export function getCategoryDescription(category: TransactionCategory): string {
  const descriptions: Record<TransactionCategory, string> = {
    [TransactionCategory.ENTERTAINMENT]: 'Entertainment (streaming, gaming, media)',
    [TransactionCategory.FOOD_DINING]: 'Food & dining (restaurants, cafes, delivery)',
    [TransactionCategory.GAS_TRANSPORT]: 'Gas & transport (fuel, rideshare, transit)',
    [TransactionCategory.GROCERY_NET]: 'Online grocery shopping',
    [TransactionCategory.GROCERY_POS]: 'In-store grocery shopping',
    [TransactionCategory.HEALTH_FITNESS]: 'Health & fitness (gym, healthcare)',
    [TransactionCategory.HOME]: 'Home & furniture',
    [TransactionCategory.KIDS_PETS]: 'Kids & pets (toys, pet supplies)',
    [TransactionCategory.MISC_NET]: 'Online miscellaneous (catch-all for online transactions)',
    [TransactionCategory.MISC_POS]: 'In-person miscellaneous (catch-all for in-person)',
    [TransactionCategory.PERSONAL_CARE]: 'Personal care (beauty, salon)',
    [TransactionCategory.SHOPPING_NET]: 'Online shopping (e-commerce)',
    [TransactionCategory.SHOPPING_POS]: 'In-store shopping (retail)',
    [TransactionCategory.TRAVEL]: 'Travel (hotels, flights, bookings)',
  };

  return descriptions[category] || 'Unknown category';
}