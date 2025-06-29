import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  page: string;
  context: string;
  feedback: string;
  rating?: number;
  type: 'bug' | 'suggestion' | 'question' | 'other';
  status: 'pending' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const helpFeedbackSchema = new Schema<IHelpFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    page: {
      type: String,
      required: true,
    },
    context: {
      type: String,
      required: true,
    },
    feedback: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    type: {
      type: String,
      enum: ['bug', 'suggestion', 'question', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
helpFeedbackSchema.index({ userId: 1, createdAt: -1 });
helpFeedbackSchema.index({ status: 1 });
helpFeedbackSchema.index({ type: 1 });
helpFeedbackSchema.index({ page: 1 });

export const HelpFeedback = mongoose.model<IHelpFeedback>(
  'HelpFeedback',
  helpFeedbackSchema,
);
