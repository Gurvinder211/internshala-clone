import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/api";

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.currentPassword || !form.newPassword) {
      setError("Please fill in both current and new password fields.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password updated successfully! Welcome to your dashboard.");
      await router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not update password. Please check your current password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f5f7f2] px-4 py-12 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#dce4d6] bg-white shadow-[0_24px_80px_rgba(35,55,35,0.12)]">
        <div className="bg-[#173b35] px-7 py-8 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 mb-4 backdrop-blur-md">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Set a Permanent Password</h1>
          <p className="mt-2 text-sm text-emerald-100/80 leading-relaxed">
            You signed in using a temporary recovery password. For your security, please choose a new permanent password to continue.
          </p>
        </div>

        <div className="px-7 py-8 sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304139]">Temporary / Current Password</span>
              <div className="relative">
                <input
                  className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 pr-12 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10 font-mono"
                  placeholder="Enter temporary password"
                  type={showCurrent ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#738078] hover:bg-[#edf2ec]"
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304139]">New Password</span>
              <div className="relative">
                <input
                  className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 pr-12 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                  placeholder="At least 8 characters (letters & numbers)"
                  type={showNew ? "text" : "password"}
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showNew ? "Hide password" : "Show password"}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#738078] hover:bg-[#edf2ec]"
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304139]">Confirm New Password</span>
              <input
                className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                placeholder="Re-type new password"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                autoComplete="new-password"
                required
              />
            </label>

            {error && (
              <p className="rounded-xl border border-[#f2caca] bg-[#fff4f3] px-4 py-3 text-sm text-[#b13b37]" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173b35] px-5 text-sm font-semibold text-white transition hover:bg-[#28584e] focus:outline-none focus:ring-4 focus:ring-[#557d5e]/20 disabled:cursor-not-allowed disabled:opacity-60 shadow-md"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <>Update &amp; Continue <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-800">
              <ShieldCheck size={14} /> Encrypted &amp; secure
            </span>
            <Link href="/" className="font-semibold text-slate-600 hover:text-slate-900">
              Skip for now
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
