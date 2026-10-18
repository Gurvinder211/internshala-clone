import axios from "axios";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/firebase";

export const API_BASE = "http://localhost:5000/api";

export type SessionResult =
  | { status: "active"; sessionId: string; user: any }
  | { status: "otp_required"; sessionId: string; maskedEmail: string; cooldownSeconds?: number }
  | { status: "blocked"; code: string; message: string };

export function getDeviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("deviceId", id);
  }
  return id;
}

export function clearLocalSession() {
  localStorage.removeItem("sessionId");
  localStorage.removeItem("authToken");
}

export function withSessionHeaders(config: any) {
  if (typeof window === "undefined") return config;
  const sid = localStorage.getItem("sessionId");
  if (sid) config.headers["X-Session-Id"] = sid;
  config.headers["X-Device-Id"] = getDeviceId();
  return config;
}

const LOSS_CODES = ["SESSION_REVOKED", "SESSION_EXPIRED"];
export function handleSessionLoss(error: any) {
  const code = error?.response?.data?.code;
  if (!LOSS_CODES.includes(code)) return;
  clearLocalSession();
  signOut(auth).catch(() => {});
  window.dispatchEvent(new CustomEvent("session-lost", { detail: { code } }));
}

let installed = false;
export function installSessionInterceptors() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) =>
    String(config.url || "").startsWith(API_BASE) ? withSessionHeaders(config) : config
  );
  axios.interceptors.response.use((r) => r, (error) => {
    handleSessionLoss(error);
    return Promise.reject(error);
  });
}

async function credentialHeader(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sessionCall(path: string, data?: unknown) {
  return axios.post(`${API_BASE}${path}`, data ?? {}, { headers: await credentialHeader() });
}

let inflight: Promise<SessionResult> | null = null;
export function startSession(): Promise<SessionResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await sessionCall("/auth/session");
      localStorage.setItem("sessionId", data.sessionId);
      return data as SessionResult;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403 && err.response.data?.status === "blocked") {
        return err.response.data as SessionResult;
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function verifySessionOtp(code: string) {
  const { data } = await sessionCall("/auth/session/verify-otp", { code });
  return data;
}

export async function resendSessionOtp() {
  const { data } = await sessionCall("/auth/session/resend-otp");
  return data;
}
