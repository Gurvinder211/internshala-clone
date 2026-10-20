import express from "express";
const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
import cors from "cors";
import { connect } from "./db.js";
import router from "./Routes/index.js";
import { createRequire } from 'module';
import { initializeApp, cert } from 'firebase-admin/app';
import path from 'path';


// Enable JSON loading in ES Modules
const require = createRequire(import.meta.url);

// In production (Render), provide the service account JSON as the
// FIREBASE_SERVICE_ACCOUNT environment variable (stringified JSON).
// In development the local serviceAccountKey.json file is used instead.
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

initializeApp({
  credential: cert(serviceAccount)
});

const port = process.env.PORT || 5000;

const allowedOrigins = [
  "https://internshala-clone-git-main-gurvinders-projects-60de784b.vercel.app",
  ...(process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are server-to-server or local tools.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("hello this is internshala backend");
});
app.use("/api", router);
connect();
app.use('/uploads/posts', express.static(path.join(process.cwd(), 'storage', 'posts')));
app.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
});
