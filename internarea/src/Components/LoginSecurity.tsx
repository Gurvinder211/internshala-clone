import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
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

const when = (v: string) =>
  new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const DeviceIcon = ({ type }: { type?: string }) =>
  type === "mobile" ? <Smartphone className="h-5 w-5" /> : type === "tablet" ? <Tablet className="h-5 w-5" /> : <Monitor className="h-5 w-5" />;

export default function LoginSecurity() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [s, h] = await Promise.allSettled([api.get("/auth/sessions"), api.get("/auth/login-history")]);
    if (s.status === "fulfilled") setSessions(s.value.data.sessions);
    if (h.status === "fulfilled") setHistory(h.value.data.history);
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    <>
      <section className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active sessions</h2>
          {sessions.length > 1 && (
            <button onClick={signOutOthers} className="text-sm text-red-600 hover:underline">Sign out all other devices</button>
          )}
        </div>
        <ul className="mt-2 divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 text-gray-700">
                <DeviceIcon type={s.deviceType} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {s.browser} {String(s.browserVersion).split(".")[0]} on {s.os}
                    {s.current && <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">This device</span>}
                  </p>
                  <p className="text-xs text-gray-500">{s.location} · {s.ip} · active {when(s.lastSeenAt)}</p>
                </div>
              </div>
              {!s.current && (
                <button onClick={() => signOutOne(s.id)} className="text-sm text-red-600 hover:underline">Sign out</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="border rounded-lg p-4">
        <h2 className="font-semibold text-gray-900">Login history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No activity yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 font-normal">When (IST)</th>
                  <th className="pb-2 font-normal">Event</th>
                  <th className="pb-2 font-normal">Device</th>
                  <th className="pb-2 font-normal">IP / location</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const st = STATUS[h.status] || { text: h.status, tone: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={h._id} className="border-t align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{when(h.createdAt)}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${st.tone}`}>{st.text}</span>
                        {h.newDevice && <span className="ml-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">New device</span>}
                        {h.newIp && <span className="ml-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">New IP</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {h.browser} {String(h.browserVersion).split(".")[0]}, {h.os}
                        <span className="block text-xs text-gray-500">{h.deviceType}{h.deviceModel ? ` · ${h.deviceModel}` : ""}</span>
                      </td>
                      <td className="py-2">{h.ip}<span className="block text-xs text-gray-500">{h.location}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
