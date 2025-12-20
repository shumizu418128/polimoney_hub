import { Hono } from "hono";
import { getServiceClient } from "../lib/supabase.ts";

export const uploadsRouter = new Hono();

// サポートする画像形式
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// バケット名
const BUCKET_NAME = "public-images";

/**
 * 画像アップロード API
 * POST /api/v1/uploads/image
 *
 * リクエスト: multipart/form-data
 * - file: 画像ファイル
 * - type: "politician_photo" | "party_logo" | "organization_logo"
 * - entity_id: 政治家ID または 政治団体ID
 */
uploadsRouter.post("/image", async (c) => {
  try {
    const contentType = c.req.header("Content-Type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Content-Type must be multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;
    const entityId = formData.get("entity_id") as string | null;

    // バリデーション
    if (!file) {
      return c.json({ error: "ファイルが必要です" }, 400);
    }

    if (!type || !["politician_photo", "party_logo", "organization_logo"].includes(type)) {
      return c.json({ error: "有効な type を指定してください" }, 400);
    }

    if (!entityId) {
      return c.json({ error: "entity_id が必要です" }, 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return c.json(
        { error: "許可されていないファイル形式です。JPEG, PNG, WebP, GIF のみ対応" },
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "ファイルサイズは5MB以下にしてください" }, 400);
    }

    // ファイル名生成
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const fileName = `${type}/${entityId}/${timestamp}.${ext}`;

    const supabase = getServiceClient();

    // バケットが存在するか確認、なければ作成
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        }
      );

      if (createError) {
        console.error("Failed to create bucket:", createError);
        return c.json({ error: "ストレージの初期化に失敗しました" }, 500);
      }
    }

    // ファイルをアップロード
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return c.json({ error: "アップロードに失敗しました" }, 500);
    }

    // 公開 URL を取得
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // entity の photo_url/logo_url を更新
    if (type === "politician_photo") {
      const { error: updateError } = await supabase
        .from("politicians")
        .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId);

      if (updateError) {
        console.error("Failed to update politician:", updateError);
        return c.json({ error: "政治家情報の更新に失敗しました" }, 500);
      }
    } else if (type === "organization_logo") {
      // 将来の実装用
      // organizations テーブルに logo_url カラムを追加した場合
    } else if (type === "party_logo") {
      // 将来の実装用
      // parties テーブルを作成した場合、または politicians テーブルに party_logo_url を追加
    }

    return c.json({
      data: {
        url: publicUrl,
        path: uploadData.path,
        type,
        entity_id: entityId,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

/**
 * 画像削除 API
 * DELETE /api/v1/uploads/image
 */
uploadsRouter.delete("/image", async (c) => {
  try {
    const { path } = await c.req.json<{ path: string }>();

    if (!path) {
      return c.json({ error: "path が必要です" }, 400);
    }

    const supabase = getServiceClient();

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error("Delete error:", error);
      return c.json({ error: "削除に失敗しました" }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});
