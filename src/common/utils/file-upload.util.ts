import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Clean, Compress, and Save images to the public directory.
 * @param file The Multer file buffer
 * @param subDirectory The folder inside /public (e.g. 'shops', 'avatars')
 */
// file-upload.utils.ts
export async function processAndSaveImage(
  file: Express.Multer.File,
  subDirectory: string,
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', subDirectory);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const safeName = file.originalname
    .split('.')[0]
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();

  const fileName = `${timestamp}-${safeName}.webp`;
  const filePath = path.join(uploadDir, fileName);

  await sharp(file.buffer)
    .resize(1000, 1000, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toFile(filePath);

  // Return ONLY the clean filename to keep data records lean
  return fileName;
}
