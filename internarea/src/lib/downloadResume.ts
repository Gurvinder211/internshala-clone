import api from "@/lib/api";

export async function downloadResume(resumeId: string, fileName = "resume") {
  const response = await api.get(`/resume/${resumeId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
