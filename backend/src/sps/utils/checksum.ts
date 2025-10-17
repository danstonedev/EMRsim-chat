import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate SHA-256 checksum for file content
 * @param filePath - Absolute path to the file
 * @returns SHA-256 checksum (hex string)
 */
export function generateFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate composite checksum for directory bundle
 * Calculates individual checksums for all JSON files in the directory,
 * then creates a composite hash from the sorted checksums.
 * 
 * @param bundleDir - Absolute path to the bundle directory
 * @returns Composite SHA-256 checksum (hex string)
 */
export function generateBundleChecksum(bundleDir: string): string {
  const files = fs.readdirSync(bundleDir)
    .filter(f => f.endsWith('.json'))
    .sort(); // Consistent ordering for deterministic hashing
  
  if (files.length === 0) {
    throw new Error(`No JSON files found in bundle directory: ${bundleDir}`);
  }

  // Calculate checksum for each file
  const checksums = files.map(f => {
    const filePath = path.join(bundleDir, f);
    return generateFileChecksum(filePath);
  });
  
  // Create composite checksum from all file checksums
  const composite = checksums.join('');
  return crypto.createHash('sha256').update(composite).digest('hex');
}

/**
 * Generate SHA-256 checksum for JavaScript object
 * Serializes object to JSON (compact format) and hashes it.
 * 
 * @param obj - Any serializable JavaScript object
 * @returns SHA-256 checksum (hex string)
 */
export function generateObjectChecksum(obj: any): string {
  const json = JSON.stringify(obj, null, 0); // Compact format (no whitespace)
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Format checksum with 'sha256:' prefix for manifest
 * @param checksum - Raw hex checksum string
 * @returns Formatted checksum (e.g., 'sha256:abc123...')
 */
export function formatChecksum(checksum: string): string {
  return `sha256:${checksum}`;
}

/**
 * Verify file checksum matches expected value
 * @param filePath - Absolute path to the file
 * @param expectedChecksum - Expected checksum (with or without 'sha256:' prefix)
 * @returns True if checksums match, false otherwise
 */
export function verifyFileChecksum(filePath: string, expectedChecksum: string): boolean {
  const actualChecksum = generateFileChecksum(filePath);
  const normalizedExpected = expectedChecksum.replace(/^sha256:/, '');
  return actualChecksum === normalizedExpected;
}

/**
 * Verify bundle checksum matches expected value
 * @param bundleDir - Absolute path to the bundle directory
 * @param expectedChecksum - Expected checksum (with or without 'sha256:' prefix)
 * @returns True if checksums match, false otherwise
 */
export function verifyBundleChecksum(bundleDir: string, expectedChecksum: string): boolean {
  const actualChecksum = generateBundleChecksum(bundleDir);
  const normalizedExpected = expectedChecksum.replace(/^sha256:/, '');
  return actualChecksum === normalizedExpected;
}
