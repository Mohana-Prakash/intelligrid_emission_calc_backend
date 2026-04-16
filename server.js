import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";

dotenv.config();
await connectDB();

console.log("Changes in feature 2 branch");
const sampleString = "This is a new variable in feature 2 branch";
console.log(sampleString);

app.listen(process.env.PORT || 4000, () =>
  console.log(`Server running on port ${process.env.PORT || 4000}`),
);
