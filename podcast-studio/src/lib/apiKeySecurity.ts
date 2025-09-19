/**
 * API Key Security Utilities
 * Implements secure storage and handling of API keys
 */

// Simple encryption/decryption for localStorage (not cryptographically secure, but better than plain text)
// In production, consider using Web Crypto API or server-side key management
class SimpleKeyEncryption {
  private static readonly KEY = 'vps-api-key-encryption-key-2024';
  
  static encrypt(text: string): string {
    if (!text) return '';
    
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ this.KEY.charCodeAt(i % this.KEY.length);
      encrypted += String.fromCharCode(charCode);
    }
    return btoa(encrypted);
  }
  
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    
    try {
      const encrypted = atob(encryptedText);
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        const charCode = encrypted.charCodeAt(i) ^ this.KEY.charCodeAt(i % this.KEY.length);
        decrypted += String.fromCharCode(charCode);
      }
      return decrypted;
    } catch {
      return '';
    }
  }
}

export class ApiKeySecurity {
  private static readonly STORAGE_PREFIX = 'vps:secure:';
  
  /**
   * Securely store an API key
   */
  static storeKey(provider: string, key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const encryptedKey = SimpleKeyEncryption.encrypt(key.trim());
      const storageKey = `${this.STORAGE_PREFIX}${provider}`;
      localStorage.setItem(storageKey, encryptedKey);
    } catch (error) {
      console.error('Failed to store API key securely:', error);
    }
  }
  
  /**
   * Securely retrieve an API key
   */
  static retrieveKey(provider: string): string {
    if (typeof window === 'undefined') return '';
    
    try {
      const storageKey = `${this.STORAGE_PREFIX}${provider}`;
      const encryptedKey = localStorage.getItem(storageKey);
      if (!encryptedKey) return '';
      
      return SimpleKeyEncryption.decrypt(encryptedKey);
    } catch (error) {
      console.error('Failed to retrieve API key securely:', error);
      return '';
    }
  }
  
  /**
   * Remove an API key from storage
   */
  static removeKey(provider: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const storageKey = `${this.STORAGE_PREFIX}${provider}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to remove API key securely:', error);
    }
  }
  
  /**
   * Clear all stored API keys
   */
  static clearAllKeys(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear API keys securely:', error);
    }
  }
  
  /**
   * Mask API key for logging (shows only first 7 and last 4 characters)
   */
  static maskKey(key: string): string {
    if (!key || key.length < 12) return '***';
    
    const start = key.substring(0, 7);
    const end = key.substring(key.length - 4);
    const middle = '*'.repeat(Math.max(0, key.length - 11));
    
    return `${start}${middle}${end}`;
  }
  
  /**
   * Validate API key format without logging the key
   */
  static validateKeyFormat(provider: string, key: string): { isValid: boolean; message?: string } {
    // Allow empty keys - they will be caught by the "required" check later
    if (!key) {
      return { isValid: true }; // Let the "required" check handle empty keys
    }
    
    const trimmedKey = key.trim();
    
    if (!trimmedKey) {
      return { isValid: true }; // Let the "required" check handle empty keys
    }
    
    if (provider === "openai") {
      if (!trimmedKey.startsWith("sk-")) {
        return { isValid: false, message: "OpenAI API key should start with 'sk-'" };
      }
      if (trimmedKey.length < 20) {
        return { isValid: false, message: "OpenAI API key appears to be too short" };
      }
    } else if (provider === "google") {
      if (trimmedKey.length < 10) {
        return { isValid: false, message: "Google API key appears to be too short" };
      }
    }
    
    return { isValid: true };
  }
  
  /**
   * Check if API key is stored for a provider
   */
  static hasStoredKey(provider: string): boolean {
    return this.retrieveKey(provider).length > 0;
  }
}
