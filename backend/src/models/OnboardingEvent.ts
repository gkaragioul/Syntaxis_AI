/**
 * @deprecated This model has no corresponding table in Prisma schema.
 * There is no 'OnboardingEvent' table in schema.prisma.
 * 
 * This appears to be a MongoDB/Mongoose model using methods like:
 * - countDocuments()
 * - aggregate()
 * - bulkCreate()
 * - find()
 * 
 * These are not compatible with Prisma/PostgreSQL.
 * 
 * If you need onboarding analytics:
 * 1. Create a new Prisma model in schema.prisma
 * 2. Run migrations: npx prisma migrate dev
 * 3. Update this file to use Prisma client
 * 
 * This class is kept for backwards compatibility but will throw errors.
 */

export interface OnboardingEventData {
  userId: string;
  eventType: string;
  stepId?: string;
  stepName?: string;
  timeSpent?: number;
  metadata?: any;
  timestamp?: Date;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * @deprecated No corresponding Prisma model exists.
 * MongoDB-style methods (countDocuments, aggregate, bulkCreate, find) are not supported.
 * Create an OnboardingEvent model in schema.prisma to use this functionality.
 */
export class OnboardingEvent {
  constructor(data: any) {
    Object.assign(this, data);
  }

  static async create(data: OnboardingEventData): Promise<never> {
    throw new Error(
      'OnboardingEvent.create is not implemented. No "OnboardingEvent" model exists in Prisma schema. ' +
      'This model uses MongoDB-style methods that are incompatible with Prisma/PostgreSQL. ' +
      'Add an OnboardingEvent model to schema.prisma and migrate your database.'
    );
  }

  static async bulkCreate(events: OnboardingEventData[]): Promise<never> {
    throw new Error(
      'OnboardingEvent.bulkCreate is not implemented. No "OnboardingEvent" model exists in Prisma schema. ' +
      'This model uses MongoDB-style methods that are incompatible with Prisma/PostgreSQL. ' +
      'Add an OnboardingEvent model to schema.prisma and migrate your database.'
    );
  }

  static async countDocuments(filter: any): Promise<never> {
    throw new Error(
      'OnboardingEvent.countDocuments is not implemented. No "OnboardingEvent" model exists in Prisma schema. ' +
      'This is a MongoDB-style method. Use prisma.modelName.count() after adding the model to schema.prisma.'
    );
  }

  static async aggregate(pipeline: any[]): Promise<never> {
    throw new Error(
      'OnboardingEvent.aggregate is not implemented. No "OnboardingEvent" model exists in Prisma schema. ' +
      'This is a MongoDB-style method. Use Prisma aggregation queries after adding the model to schema.prisma.'
    );
  }

  static async find(filter: any): Promise<never> {
    throw new Error(
      'OnboardingEvent.find is not implemented. No "OnboardingEvent" model exists in Prisma schema. ' +
      'This is a MongoDB-style method. Use prisma.modelName.findMany() after adding the model to schema.prisma.'
    );
  }
}

export default OnboardingEvent;
