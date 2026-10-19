import { selectuser } from "@/Feature/Userslice";
import LoginSecurity from "@/Components/LoginSecurity";
import PhoneNumber from "@/Components/PhoneNumber";
import ResumeHistory from "@/Components/ResumeHistory";
import { Download, ExternalLink, FileText, Mail, Plus, User } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { downloadResume } from "@/lib/downloadResume";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

const Profile = () => {
  const user = useSelector(selectuser);
  const [sub, setSub] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [defaultResumeId, setDefaultResumeId] = useState<string | null>(null);
  const [resumesLocked, setResumesLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const userKey = user?.email;

  const load = useCallback(async () => {
    setLoading(true);
    const [subResult, resumeResult] = await Promise.allSettled([
      api.get("/subscription/me"),
      api.get("/resume"),
    ]);

    if (subResult.status === "fulfilled") {
      setSub(subResult.value.data.subscription);
      setHistory(subResult.value.data.history || []);
    }
    if (resumeResult.status === "fulfilled") {
      setResumes(resumeResult.value.data.resumes || []);
      setDefaultResumeId(resumeResult.value.data.defaultResumeId || null);
      setResumesLocked(false);
    } else if ((resumeResult.reason as any)?.response?.data?.code === "PREMIUM_REQUIRED") {
      setResumesLocked(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userKey) void load();
  }, [userKey, load]);

  const makeDefault = async (id: string) => {
    try {
      await api.post(`/resume/${id}/set-default`);
      setDefaultResumeId(id);
      toast.success("Default resume updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not update default resume");
    }
  };

  const invoices = history.filter((t) => t.status === "PAID");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="relative h-32 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              {user?.photo ? (
                <img src={user.photo} alt={user.name} className="w-24 h-24 rounded-full border-4 border-white shadow-lg" />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-16 pb-8 px-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <div className="mt-2 flex items-center justify-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-600 font-semibold text-2xl">0</span>
                  <p className="text-blue-600 text-sm mt-1">Active Applications</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <span className="text-green-600 font-semibold text-2xl">0</span>
                  <p className="text-green-600 text-sm mt-1">Accepted Applications</p>
                </div>
              </div>

              <div className="flex justify-center">
                <Link
                  href="/userapplication"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  View Applications
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </div>

              <section className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Subscription</h2>
                  <Link href="/subscription" className="text-sm text-blue-600 hover:underline">Manage plan</Link>
                </div>
                {sub ? (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-gray-500">Plan</dt>
                        <dd className="font-medium text-gray-900">{sub.planName}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Applications left</dt>
                        <dd className="font-medium text-gray-900">
                          {sub.unlimited ? "Unlimited" : `${sub.quotaRemaining} of ${sub.quotaLimit}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">{sub.plan === "FREE" ? "Plan ends" : "Renews / ends"}</dt>
                        <dd className="font-medium text-gray-900">{sub.validTill ? formatDate(sub.validTill) : "No expiry"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Quota resets</dt>
                        <dd className="font-medium text-gray-900">{formatDate(sub.quotaResetsAt)}</dd>
                      </div>
                    </dl>
                    {sub.nextPlan && (
                      <p className="mt-3 text-xs text-amber-700">
                        {sub.nextPlan === "FREE"
                          ? "Cancelled: moves to Free when this period ends."
                          : `Scheduled change: you can continue on ${titleCase(sub.nextPlan)} when this period ends.`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">{loading ? "Loading..." : "Could not load your subscription."}</p>
                )}
              </section>

              <section className="border rounded-lg p-4">
                <h2 className="font-semibold text-gray-900">Invoices</h2>
                {invoices.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">{loading ? "Loading..." : "No payments yet."}</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-2 font-normal">Invoice</th>
                          <th className="pb-2 font-normal">Plan</th>
                          <th className="pb-2 font-normal">Amount</th>
                          <th className="pb-2 font-normal">Paid on</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((t) => (
                          <tr key={t._id} className="border-t">
                            <td className="py-2">{t.invoiceNumber}</td>
                            <td className="py-2">{titleCase(t.plan)}</td>
                            <td className="py-2">₹{t.amount}</td>
                            <td className="py-2">{formatDate(t.paidAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Resumes</h2>
                  {!resumesLocked && (
                    <Link href="/resume-builder/new" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      <Plus className="h-4 w-4" /> New resume
                    </Link>
                  )}
                </div>
                {resumesLocked ? (
                  <p className="mt-3 text-sm text-gray-600">
                    Resume Builder is included with paid plans.{" "}
                    <Link href="/subscription" className="text-blue-600 hover:underline">See plans</Link>
                  </p>
                ) : resumes.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">{loading ? "Loading..." : "No resumes yet."}</p>
                ) : (
                  <ul className="mt-2 divide-y">
                    {resumes.map((r) => (
                      <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-gray-900">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="truncate">{r.title || "Untitled resume"}</span>
                            {r._id === defaultResumeId && (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Default</span>
                            )}
                            {r.pdfOutdated && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Edited since PDF</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {titleCase(r.template || "classic")} template · {r.status === "generated" ? "PDF ready" : "Draft"} · updated {formatDate(r.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Link href={`/resume-builder/${r._id}`} className="text-blue-600 hover:underline">Edit</Link>
                          {r.status === "generated" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadResume(r._id, r.personal?.fullName || "resume")
                                    .catch(() => toast.error("Could not download the PDF"))
                                }
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Download className="h-4 w-4" /> Download
                              </button>
                              {r._id !== defaultResumeId && (
                                <button type="button" onClick={() => makeDefault(r._id)} className="text-gray-700 hover:underline">
                                  Set as default
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!resumesLocked && <ResumeHistory />}
              <PhoneNumber />
              <LoginSecurity />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
