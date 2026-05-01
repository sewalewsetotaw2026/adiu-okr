/**
 * Validation utilities for Kacha HRIS
 */

/**
 * Validates that a full name contains exactly three words.
 */
export const validateFullName = (name: string): boolean => {
  if (!name) return false;
  const words = name.trim().split(/\s+/);
  return words.length === 3;
};

/**
 * Validates phone number format:
 * - If starts with +, allows international format (7-15 digits).
 * - If starts with 251, total length must be 12.
 * - If starts with 0, total length must be 10.
 */
export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return false;
  
  // If explicitly starting with +, allow as international (7-15 digits)
  if (phone.startsWith('+')) {
    const digitsOnly = phone.substring(1).replace(/\D/g, '');
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }

  // Normalize for local checks: remove all non-numeric characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Check for 251 (12 digits)
  if (cleanPhone.startsWith('251')) {
    return cleanPhone.length === 12;
  } 
  
  // Check for 0 (10 digits)
  else if (cleanPhone.startsWith('0')) {
    return cleanPhone.length === 10;
  }
  
  return false;
};

/**
 * Normalizes a phone number.
 * - International format (+...) is preserved.
 * - Local Ethiopian (09...) is normalized to +251...
 */
export const normalizePhoneNumber = (phone: string): string | null => {
  if (!validatePhoneNumber(phone)) return null;
  
  if (phone.startsWith('+')) {
    // Keep international format as is (just ensure no extra spaces/dashes internally)
    return '+' + phone.substring(1).replace(/\D/g, '');
  }

  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.startsWith('251')) {
    return `+${cleanPhone}`;
  } else if (cleanPhone.startsWith('0')) {
    return `+251${cleanPhone.substring(1)}`;
  }
  
  return null;
};

/**
 * Validates if a string is numeric.
 */
export const validateIsNumeric = (value: string): boolean => {
  if (!value) return false;
  return /^\d+$/.test(value);
};
