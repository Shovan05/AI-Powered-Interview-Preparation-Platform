import mongoose, { Schema } from "mongoose";

export interface IBlacklistToken {
  token: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const blacklistTokenSchema = new Schema<IBlacklistToken>(
  {
    token: {
      type: String,
      required: [true, "token is required to be added in blacklist"],
    },
  },
  {
    timestamps: true,
  }
);

const tokenBlacklistModel = mongoose.model<IBlacklistToken>(
  "blacklistTokens",
  blacklistTokenSchema
);

export default tokenBlacklistModel;