import axios from "axios";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

export const translateText = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { text, target = "id" } = req.body;

    if (!text) {
      res.status(400).json({ error: "Text is required for translation" });
      return;
    }

    const CF_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
    const CF_SECRET = process.env.CLOUDFLARE_TRANSLATOR_SECRET;

    if (!CF_WORKER_URL || !CF_SECRET) {
      console.warn(
        "Translation requested but Cloudflare config is missing from environment. CF_WORKER_URL or CF_TRANSLATE_SECRET."
      );
      res
        .status(500)
        .json({ error: "Translation service is not properly configured." });
      return;
    }

    // 1. Create security parameters
    const expiry = Date.now() + 60000; // 1 min validity

    // 2. Generate HMAC signature (Server-side = Secure)
    const signature = crypto
      .createHmac("sha256", CF_SECRET)
      .update(`${text}${expiry}`)
      .digest("hex");

    // 3. Forward to Cloudflare Worker
    const response = await axios.post(CF_WORKER_URL, {
      text,
      expiry,
      signature,
      target,
    });

    res.status(200).json({
      translatedText:
        response.data.translated_text || response.data.translatedText,
    });
  } catch (error: any) {
    if (error.response) {
      console.error("Translation failed at Cloudflare:", error.response.data);
    } else {
      console.error("Translation request failed:", error.message);
    }
    res.status(500).json({ error: "Translation failed" });
  }
};

export const bulkTranslateText = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { texts, target = "id" } = req.body;

    if (!texts || !Array.isArray(texts)) {
      res
        .status(400)
        .json({ error: "Texts array is required for bulk translation" });
      return;
    }

    const CF_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
    const CF_SECRET = process.env.CLOUDFLARE_TRANSLATOR_SECRET;

    if (!CF_WORKER_URL || !CF_SECRET) {
      console.warn(
        "Translation requested but Cloudflare config is missing from environment."
      );
      res
        .status(500)
        .json({ error: "Translation service is not properly configured." });
      return;
    }

    const results = await Promise.all(
      texts.map(async (text) => {
        if (!text) return { original: text, translated: "" };

        try {
          const expiry = Date.now() + 60000; // 1 min validity
          const signature = crypto
            .createHmac("sha256", CF_SECRET)
            .update(`${text}${expiry}`)
            .digest("hex");

          const response = await axios.post(CF_WORKER_URL, {
            text,
            expiry,
            signature,
            target,
          });

          return {
            original: text,
            translated:
              response.data.translated_text || response.data.translatedText,
          };
        } catch (err: any) {
          console.error(`Failed to translate: ${text}`, err.message);
          return { original: text, translated: null, error: true };
        }
      })
    );

    res.status(200).json({ translations: results });
  } catch (error: any) {
    console.error("Bulk translation failed:", error.message);
    res.status(500).json({ error: "Bulk translation failed" });
  }
};
