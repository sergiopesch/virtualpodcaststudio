export class ApiKeySecurity {
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
}
