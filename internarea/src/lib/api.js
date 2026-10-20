// internarea/src/lib/api.js
import axios from "axios";
import { auth } from "@/firebase/firebase";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const sessionId = localStorage.getItem("sessionId");
    if (sessionId) config.headers["X-Session-Id"] = sessionId;
  }

  // Prefer an active Firebase session; fall back to a stored local JWT.
  if (auth.currentUser) {
    config.headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  } else {
    const localToken = localStorage.getItem("authToken");
    if (localToken) {
      config.headers.Authorization = `Bearer ${localToken}`;
    }
  }
  return config;
});

export default api;
