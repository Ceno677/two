import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const metadataSchema = z.object({
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(13).regex(/^[A-Za-z0-9]+$/),
  description: z.string().trim().max(1_000).default(""),
  website: z.url().max(300).optional().or(z.literal("")),
  twitter: z.url().max(300).optional().or(z.literal("")),
  telegram: z.url().max(300).optional().or(z.literal("")),
});

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageBytes = 5 * 1024 * 1024;

type PinataUpload = { data?: { cid?: string }; cid?: string };

async function uploadToPinata(file: File, jwt: string) {
  const body = new FormData();
  body.set("network", "public");
  body.set("name", file.name);
  body.set("file", file);

  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`Pinata upload failed (${response.status})`);
  }
  const payload = await response.json() as PinataUpload;
  const cid = payload.data?.cid ?? payload.cid;
  if (!cid) throw new Error("Pinata response did not contain a CID");
  return cid;
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ code: "METADATA_STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const image = form.get("image");
    const fields = metadataSchema.safeParse({
      name: form.get("name"),
      symbol: form.get("symbol"),
      description: form.get("description") ?? "",
      website: form.get("website") ?? "",
      twitter: form.get("twitter") ?? "",
      telegram: form.get("telegram") ?? "",
    });
    if (!fields.success) {
      return NextResponse.json({ code: "INVALID_METADATA", issues: fields.error.issues }, { status: 400 });
    }
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ code: "IMAGE_REQUIRED" }, { status: 400 });
    }
    if (!allowedImageTypes.has(image.type) || image.size > maxImageBytes) {
      return NextResponse.json({ code: "INVALID_IMAGE", message: "Use a PNG, JPG, or WebP image up to 5 MB." }, { status: 400 });
    }

    const imageCid = await uploadToPinata(image, jwt);
    const metadata = {
      name: fields.data.name,
      symbol: fields.data.symbol.toUpperCase(),
      description: fields.data.description,
      image: `ipfs://${imageCid}`,
      showName: true,
      createdOn: process.env.NEXT_PUBLIC_APP_URL ?? "https://near-jade.vercel.app",
      ...(fields.data.website ? { website: fields.data.website } : {}),
      ...(fields.data.twitter ? { twitter: fields.data.twitter } : {}),
      ...(fields.data.telegram ? { telegram: fields.data.telegram } : {}),
    };
    const metadataFile = new File(
      [JSON.stringify(metadata)],
      `${fields.data.symbol.toLowerCase()}-metadata.json`,
      { type: "application/json" },
    );
    const metadataCid = await uploadToPinata(metadataFile, jwt);

    return NextResponse.json({
      uri: `ipfs://${metadataCid}`,
      metadataCid,
      imageCid,
    });
  } catch (error) {
    return NextResponse.json({
      code: "METADATA_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "Metadata upload failed",
    }, { status: 502 });
  }
}
