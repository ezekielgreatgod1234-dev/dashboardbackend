import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import authRoute from "./route/Auth.route.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "https://campusdashboard.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());

app.use("/auth", authRoute);

app.get("/", (req, res) => {
  res.json({ message: "API is running", status: true });
});

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not set in your .env file");
    }

    await mongoose.connect(MONGO_URI);
    console.log("My Database is connected");

    app.listen(PORT, () => {
      console.log(`server is listening on port ${PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
}

start();