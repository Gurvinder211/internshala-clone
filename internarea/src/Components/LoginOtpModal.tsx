import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { resendSessionOtp, verifySessionOtp } from "@/lib/session";
import { useTranslation } from "next-i18next/pages";

export default function LoginOtpModal({ maskedEmail, deliveryMode = "email", onVerified, onCancel }: {
  maskedEmail: string;
  deliveryMode?: "email" | "console";
  onVerified: (user: any) => void;
  onCancel: (message?: string) => void;
}) {
  const { t } = useTranslation("common");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await verifySessionOtp(code.trim());
      onVerified(data.user);
    } catch (err: any) {
      const body = err?.response?.data;
      if (["LOCKED", "SESSION_EXPIRED", "SESSION_REQUIRED"].includes(body?.code)) {
        onCancel(body.error || "Please sign in again.");
        return;
      }
      setError(body?.error || t("otp.verifyCodeError"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const data = await resendSessionOtp();
      setCooldown(data.cooldownSeconds || 60);
      if (data.deliveryMode === "console") {
        setError(t("otp.emailNotConfigured"));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || t("otp.resendFailed"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{t("auth.verifyIdentity")}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {deliveryMode === "console"
            ? t("otp.emailNotConfiguredDevelopment")
            : t("otp.codeSent", { email: maskedEmail })}
        </p>
        <input
          autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000" aria-label={t("auth.verificationCode")}
          className="mt-4 h-12 w-full rounded-xl border border-gray-300 px-4 text-center text-xl tracking-[0.4em] outline-none focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy || code.length < 6}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#173b35] text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : t("auth.verifyAndSignIn")}
        </button>
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" onClick={resend} disabled={cooldown > 0}
            className="text-[#557d5e] disabled:text-gray-400">
            {cooldown > 0 ? t("otp.resendIn", { seconds: cooldown }) : t("auth.resendCode")}
          </button>
          <button type="button" onClick={() => onCancel()} className="text-gray-500 hover:text-gray-800">{t("common.cancel")}</button>
        </div>
      </form>
    </div>
  );
}
