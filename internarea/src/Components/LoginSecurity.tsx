import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet, KeyRound, Globe, Shield, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/api";

const STATUS: Record<string, { text: string; tone: string }> = {
  SUCCESS: { text: "Signed in", tone: "bg-green-100 text-green-700" },
  OTP_VERIFIED: { text: "Code verified", tone: "bg-green-100 text-green-700" },
  OTP_SENT: { text: "Code sent", tone: "bg-amber-100 text-amber-700" },
  OTP_FAILED: { text: "Wrong or expired code", tone: "bg-red-100 text-red-700" },
  FAILED_PASSWORD: { text: "Wrong password", tone: "bg-red-100 text-red-700" },
  BLOCKED_TIME_WINDOW: { text: "Blocked: mobile hours", tone: "bg-red-100 text-red-700" },
  LOGOUT: { text: "Signed out", tone: "bg-gray-100 text-gray-700" },
  SESSION_REVOKED: { text: "Session ended", tone: "bg-gray-100 text-gray-700" },
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
  pt: "Portuguese",
  zh: "Chinese",
  fr: "French",
};

const when = (v: string) =>
  new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const DeviceIcon = ({ type }: { type?: string }) =>
  type === "mobile" ? <Smartphone className="h-5 w-5" /> : type === "tablet" ? <Tablet className="h-5 w-5" /> : <Monitor className="h-5 w-5" />;

export default function LoginSecurity() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [langHistory, setLangHistory] = useState<any[]>([]);
  const [resetHistory, setResetHistory] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState(false);

  const load = useCallback(async () => {
    const [s, h, l, r] = await Promise.allSettled([
      api.get("/auth/sessions"),
      api.get("/auth/login-history"),
      api.get("/language/history"),
      api.get("/password-reset/history"),
    ]);

    if (s.status === "fulfilled") setSessions(s.value.data.sessions || []);
    if (h.status === "fulfilled") {
      setHistory(h.value.data.history || []);
      setHistoryError(false);
    } else {
      setHistoryError(true);
    }
    if (l.status === "fulfilled") setLangHistory(l.value.data.history || []);
    if (r.status === "fulfilled") setResetHistory(r.value.data.history || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOutOne = async (id: string) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast.success("Device signed out");
      void load();
    } catch {
      toast.error("Could not sign that device out");
    }
  };

  const signOutOthers = async () => {
    try {
      const { data } = await api.post("/auth/sessions/revoke-others");
      toast.success(data.revoked ? `Signed out ${data.revoked} other device(s)` : "No other devices were signed in");
      void load();
    } catch {
      toast.error("Could not sign out other devices");
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <section className="border rounded-xl p-5 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-700" />
            <h2 className="font-semibold text-gray-900">Active Sessions</h2>
          </div>
          {sessions.length > 1 && (
            <button onClick={signOutOthers} className="text-xs font-semibold text-red-600 hover:underline">
              Sign out other devices ({sessions.length - 1})
            </button>
          )}
        </div>
        <ul className="mt-3 divide-y divide-gray-100">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 text-gray-700">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gray-50 text-gray-600">
                  <DeviceIcon type={s.deviceType} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {s.browser} {String(s.browserVersion).split(".")[0]} on {s.os}
                    {s.current && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Current Device</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.location || "Unknown"} · IP: {s.ip} · Last seen: {when(s.lastSeenAt)}
                  </p>
                </div>
              </div>
              {!s.current && (
                <button
                  onClick={() => signOutOne(s.id)}
                  className="rounded px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200"
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Login History */}
      <section className="border rounded-xl p-5 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="font-semibold text-gray-900">Login Activity History</h2>
          <span className="text-xs text-gray-400">Past 30 events</span>
        </div>
        {historyError ? (
          <p className="mt-3 text-xs text-red-600">Could not load login history. Refresh the page and try again.</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No login activity recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-semibold">Timestamp (IST)</th>
                  <th className="pb-2 font-semibold">Status / Event</th>
                  <th className="pb-2 font-semibold">Environment</th>
                  <th className="pb-2 font-semibold">IP &amp; Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => {
                  const st = STATUS[h.status] || { text: h.status, tone: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={h._id} className="align-top hover:bg-gray-50/50">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600 font-mono">{when(h.createdAt)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.text}</span>
                        {h.newDevice && <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-semibold">New Device</span>}
                        {h.newIp && <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 font-semibold">New IP</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">
                        {h.browser} {String(h.browserVersion).split(".")[0]}, {h.os}
                        <span className="block text-[11px] text-gray-400">{h.deviceType}{h.deviceModel ? ` · ${h.deviceModel}` : ""}</span>
                      </td>
                      <td className="py-2.5 text-gray-700">
                        {h.ip}
                        <span className="block text-[11px] text-gray-400">{h.location || "Unknown"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Language Change History */}
      <section className="border rounded-xl p-5 bg-white shadow-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <Globe className="h-5 w-5 text-emerald-700" />
          <h2 className="font-semibold text-gray-900">Language Audit History</h2>
        </div>
        {langHistory.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No language changes recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-semibold">Date &amp; Time (IST)</th>
                  <th className="pb-2 font-semibold">Language Transition</th>
                  <th className="pb-2 font-semibold">OTP Verification</th>
                  <th className="pb-2 font-semibold">Device &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {langHistory.map((l) => (
                  <tr key={l._id} className="align-top hover:bg-gray-50/50">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600 font-mono">{when(l.createdAt)}</td>
                    <td className="py-2.5 pr-3 font-medium text-gray-800">
                      {LANG_LABELS[l.fromLanguage] || l.fromLanguage} → <span className="font-bold text-emerald-800">{LANG_LABELS[l.toLanguage] || l.toLanguage}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {l.otpRequired ? (
                        l.otpVerified ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                            <CheckCircle2 size={12} /> Verified (French)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <AlertTriangle size={12} /> Pending OTP
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-[11px]">Not required</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {l.browser || "Browser"} on {l.os || "OS"}
                      <span className="block text-[11px] text-gray-400 font-mono">{l.ip}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Password Reset History */}
      <section className="border rounded-xl p-5 bg-white shadow-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <KeyRound className="h-5 w-5 text-emerald-700" />
          <h2 className="font-semibold text-gray-900">Password Reset History</h2>
        </div>
        {resetHistory.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No password reset requests recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-semibold">Requested (IST)</th>
                  <th className="pb-2 font-semibold">Method</th>
                  <th className="pb-2 font-semibold">Result</th>
                  <th className="pb-2 font-semibold">Device &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resetHistory.map((r) => (
                  <tr key={r._id} className="align-top hover:bg-gray-50/50">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600 font-mono">{when(r.requestedAt || r.createdAt)}</td>
                    <td className="py-2.5 pr-3 uppercase font-semibold text-gray-700">
                      {r.method === "sms" ? "Mobile SMS" : "Email"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.deliveryFailed ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          <XCircle size={12} /> Delivery failed
                        </span>
                      ) : r.verified ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          <CheckCircle2 size={12} /> Password Reset Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          <AlertTriangle size={12} /> Code sent, not completed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {r.browser || "Browser"} on {r.os || "OS"}
                      <span className="block text-[11px] text-gray-400 font-mono">{r.ip}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
