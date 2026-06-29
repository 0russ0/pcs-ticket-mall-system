import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  const isBlobUrl = !!url && url.startsWith("https://") && url.includes(".blob.vercel-storage.com");
  if (!isBlobUrl || !url) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 });
  }

  const blobRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!blobRes.ok || !blobRes.body) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return new Response(blobRes.body, {
    headers: {
      "Content-Type": blobRes.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
