import mongoose, { Schema, Types } from "mongoose";

export interface IQuestion {
  question: string;
  intention: string;
  answer: string;
}

export interface ISkillGap {
  skill: string;
  severity: "low" | "medium" | "high";
}

export interface IPreparationDay {
  day: number;
  focus: string;
  tasks: string[];
}

export interface IInterviewReport {
  jobDescription: string;
  resume?: string;
  selfDescription?: string;
  matchScore?: number;
  technicalQuestions: IQuestion[];
  behavioralQuestions: IQuestion[];
  skillGaps: ISkillGap[];
  preparationPlan: IPreparationDay[];
  user?: Types.ObjectId;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const technicalQuestionSchema = new Schema<IQuestion>(
  {
    question: {
      type: String,
      required: [true, "Technical question is required"],
    },
    intention: {
      type: String,
      required: [true, "Intention is required"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  { _id: false }
);

const behavioralQuestionSchema = new Schema<IQuestion>(
  {
    question: {
      type: String,
      required: [true, "Behavioral question is required"],
    },
    intention: {
      type: String,
      required: [true, "Intention is required"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  { _id: false }
);

const skillGapSchema = new Schema<ISkillGap>(
  {
    skill: {
      type: String,
      required: [true, "Skill is required"],
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: [true, "Severity is required"],
    },
  },
  { _id: false }
);

const preparationPlanSchema = new Schema<IPreparationDay>({
  day: {
    type: Number,
    required: [true, "Day is required"],
  },
  focus: {
    type: String,
    required: [true, "Focus is required"],
  },
  tasks: [
    {
      type: String,
      required: [true, "Task is required"],
    },
  ],
});

const interviewReportSchema = new Schema<IInterviewReport>(
  {
    jobDescription: {
      type: String,
      required: [true, "Job description is required"],
    },
    resume: {
      type: String,
    },
    selfDescription: {
      type: String,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    technicalQuestions: [technicalQuestionSchema],
    behavioralQuestions: [behavioralQuestionSchema],
    skillGaps: [skillGapSchema],
    preparationPlan: [preparationPlanSchema],
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    title: {
      type: String,
      required: [true, "Job title is required"],
    },
  },
  {
    timestamps: true,
  }
);

const interviewReportModel = mongoose.model<IInterviewReport>(
  "InterviewReport",
  interviewReportSchema
);

export default interviewReportModel;