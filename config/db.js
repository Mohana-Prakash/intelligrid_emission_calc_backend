import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const mongoMessage = `MongoDB connected: ${mongoose.connection.host}`;
  console.log(mongoMessage);
};
