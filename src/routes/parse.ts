import multer from "multer";
import { postToDotnet } from "../integrations/dotnetUpload";
import { normaliseDotnet, fallbackPhone } from "../adapters/dotnetParserAdapter";
import type { Request, Response } from "express";

const upload = multer({ storage: multer.memoryStorage() });

export const parseRoute = (app: any) => {
  app.post("/api/parse", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      
      const vendor = await postToDotnet(req.file.buffer, req.file.originalname, req.file.mimetype);
      const out = normaliseDotnet(vendor);

      // optional: if phone missing and you have vendor raw text available, derive gently
      if (!out.phone) {
        const possibleText = JSON.stringify(vendor?.data ?? vendor?.Data ?? {}); // replace with real raw text if provided
        out.phone = fallbackPhone(possibleText);
      }

      // Logging (one line per parse)
      console.log(JSON.stringify({
        source: "dotnet",
        phoneMissing: !out.phone,
        weCount: (vendor?.data?.workExperience?.length || vendor?.Data?.WorkExperience?.length || 0)
      }));

      return res.json(out);
    } catch (e: any) {
      return res.status(503).json({ error: "ParserUnavailable", detail: e?.message });
    }
  });
};
