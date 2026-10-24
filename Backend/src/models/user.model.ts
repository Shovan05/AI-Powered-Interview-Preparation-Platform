import mongoose, { Schema } from "mongoose";

export interface IUser {
  username: string;
  email: string;
  password: string;
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    unique: [true, "username already taken"],
    required: true,
  },

  email: {
    type: String,
    unique: [true, "Account already exists with this email address"],
    required: true,
  },

  password: {
    type: String,
    required: true,
  },
});

const userModel = mongoose.model<IUser>("users", userSchema);

export default userModel;