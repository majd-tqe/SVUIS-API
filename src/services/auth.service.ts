import { randomUUID } from 'node:crypto';
import { svuisClient } from '../adapters/svuis-client.js';
import { cookieManager } from '../adapters/cookie-manager.js';
import { SvuisAuthError } from '../errors/index.js';

export const authService = {
  async login(username: string, password: string, otp?: string) {
    const sessionId = randomUUID();

    try {
      const result = await svuisClient.login(sessionId, username, password, otp);
      if (!result.success) {
        throw new SvuisAuthError('Invalid username or password', 'INVALID_CREDENTIALS');
      }
  
      const studentProfileHtml = result.profileHtml!;
  
      const { parseProfile } = await import('../parsers/index.js');
      const profile = parseProfile(studentProfileHtml);
  
      return {
        sessionId,
        student: {
          id: profile.id,
          username: profile.username,
          name: profile.names.fullEn,
        },
      };
    } catch (err) {
      cookieManager.delete(sessionId);
      throw err;
    }
  },

  async logout(sessionId: string): Promise<void> {
    await svuisClient.logout(sessionId);
  },

  async getStatus(sessionId: string) {
    const isValid = await svuisClient.isLoggedIn(sessionId);
    return { loggedIn: isValid };
  },

  getSession(sessionId: string) {
    const cookies = cookieManager.get(sessionId);
    return cookies ? { id: sessionId } : null;
  },
};
