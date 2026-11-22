// Collections a vendor can place a gift in.
//
// Keep this list in step with COLLECTION_TILES (web/lib/expo-app-config.ts),
// which drives the admin home tiles, and CURATED_COLLECTIONS
// (src/lib/catalog.ts), which drives the app's collection pages. The strings
// are stored in products.occasions; the app's offersForCollection() reads them
// to decide which gifts appear in each collection.

export const PRODUCT_COLLECTIONS = [
  'birthday',
  'for-her',
  'for-him',
  'thank-you',
  'just-because',
  'anniversary',
  'congratulations',
] as const;

export type ProductCollection = (typeof PRODUCT_COLLECTIONS)[number];

export function isProductCollection(value: string): value is ProductCollection {
  return (PRODUCT_COLLECTIONS as readonly string[]).includes(value);
}
