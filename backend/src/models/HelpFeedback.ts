import { logger } from '../utils/logger';

export class HelpFeedback {
  constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
  }

  async save() {
    logger.debug('MOCK: Saving HelpFeedback', { feedback: this });
    return this;
  }

  static find(query: Record<string, unknown>) {
    return {
      sort: () => ({
        limit: () => []
      })
    };
  }
}

export default HelpFeedback;
