import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ResumeBuilderIndex() {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/resume-builder/new");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f3f5f2] flex items-center justify-center text-sm text-slate-500">
      Loading resume builder...
    </div>
  );
}
