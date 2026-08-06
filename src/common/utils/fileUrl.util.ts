export function generateAvatarUrl(filename: string): string {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';

  return `${baseUrl}/public/avatars/${filename}`;
}

export function generateHarvestUrl(filename: string): string {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';

  return `${baseUrl}/public/harvests/${filename}`;
}

export function generateProductUrl(filename: string): string {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';

  return `${baseUrl}/public/products/${filename}`;
}
