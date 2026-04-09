const MAX_IMAGE_DATA_URL_LENGTH = 5_500_000;
const ALLOWED_IMAGE_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
  'data:image/svg+xml',
];

export function validateImagePayload(image: string, fieldName: string): string {
  const normalized = image.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  const isAllowed = ALLOWED_IMAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(`${fieldName} must be a supported image payload.`);
  }

  if (normalized.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error(`${fieldName} exceeds the maximum supported image size.`);
  }

  return normalized;
}
