import axios from "axios";
import FormData from "form-data";

export async function postToDotnet(buffer: Buffer, filename = "cv.pdf", mime = "application/pdf") {
  const base = process.env.DOTNET_CV_API_URL!;
  const form = new FormData();
  form.append("file", buffer, { filename, contentType: mime, knownLength: buffer.length });
  const res = await axios.post(`${base}/api/documentparser/parse`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`.NET parse failed: ${res.status}`);
  return res.data;
}
