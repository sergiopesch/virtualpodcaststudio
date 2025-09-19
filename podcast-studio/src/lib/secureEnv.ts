/**
 * Secure Environment Variable Utilities
 * Provides safe handling of environment variables that may contain sensitive data
 */

export class SecureEnv {
  /**
   * Safely get an environment variable without logging its value
   */
  static get(key: string): string | undefined {
    const value = process.env[key];
    return value;
  }
  
  /**
   * Safely get an environment variable with a default value
   */
  static getWithDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }
  
  /**
   * Check if an environment variable exists without exposing its value
   */
  static exists(key: string): boolean {
    return !!process.env[key];
  }
  
  /**
   * Get environment variable info for logging (shows only existence and length)
   */
  static getInfo(key: string): { exists: boolean; length: number } {
    const value = process.env[key];
    return {
      exists: !!value,
      length: value ? value.length : 0
    };
  }
  
  /**
   * Validate required environment variables
   */
  static validateRequired(keys: string[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const key of keys) {
      if (!this.exists(key)) {
        missing.push(key);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Mask sensitive environment variable values for logging
   */
  static maskValue(key: string, value: string): string {
    // Common sensitive keys that should be masked
    const sensitiveKeys = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'PASS', 'KEY'];
    
    const isSensitive = sensitiveKeys.some(sensitive => 
      key.toUpperCase().includes(sensitive)
    );
    
    if (!isSensitive || !value) {
      return value;
    }
    
    if (value.length <= 8) {
      return '***';
    }
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    return `${start}***${end}`;
  }
}
