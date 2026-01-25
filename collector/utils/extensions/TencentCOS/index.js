const fs = require("fs");
const path = require("path");
const { default: slugify } = require("slugify");
const { v4 } = require("uuid");
const { writeToServerDocuments, sanitizeFileName } = require("../../files");
const { tokenizeString } = require("../../tokenizer");
const COS = require("cos-nodejs-sdk-v5");

// Supported file extensions for text extraction
const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".xml",
  ".html",
  ".htm",
  ".log",
  ".yaml",
  ".yml",
  ".ini",
  ".conf",
  ".cfg",
];

/**
 * Load documents from Tencent Cloud COS
 * @param {object} args - forwarded request body params
 * @param {import("../../../middleware/setDataSigner").ResponseWithSigner} response - Express response object with encryptionWorker
 * @returns
 */
async function loadTencentCOS(
  {
    secretId = null,
    secretKey = null,
    bucket = null,
    region = null,
    prefix = "",
  },
  response
) {
  if (!secretId || !secretKey) {
    return {
      success: false,
      reason: "SecretId 和 SecretKey 是必需的。",
    };
  }

  if (!bucket) {
    return {
      success: false,
      reason: "存储桶名称是必需的。",
    };
  }

  if (!region) {
    return {
      success: false,
      reason: "地域 (Region) 是必需的。",
    };
  }

  console.log(`-- Working Tencent COS: ${bucket} --`);

  try {
    const cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });

    // List objects in the bucket
    const listResult = await new Promise((resolve, reject) => {
      cos.getBucket(
        {
          Bucket: bucket,
          Region: region,
          Prefix: prefix,
          MaxKeys: 1000,
        },
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });

    const objects = listResult.Contents || [];

    if (!objects.length) {
      return {
        success: false,
        reason: "在指定的存储桶/前缀中没有找到任何对象。",
      };
    }

    // Filter for supported file types
    const supportedObjects = objects.filter((obj) => {
      const ext = path.extname(obj.Key || "").toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && parseInt(obj.Size) > 0;
    });

    if (!supportedObjects.length) {
      return {
        success: false,
        reason: `没有找到支持的文件类型。支持的扩展名: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      };
    }

    const outFolder = slugify(`cos-${bucket.split("-")[0]}-${v4().slice(0, 4)}`).toLowerCase();
    const outFolderPath =
      process.env.NODE_ENV === "development"
        ? path.resolve(
            __dirname,
            `../../../../server/storage/documents/${outFolder}`
          )
        : path.resolve(process.env.STORAGE_DIR, `documents/${outFolder}`);

    if (!fs.existsSync(outFolderPath))
      fs.mkdirSync(outFolderPath, { recursive: true });

    let processedCount = 0;

    for (const obj of supportedObjects) {
      try {
        const content = await new Promise((resolve, reject) => {
          cos.getObject(
            {
              Bucket: bucket,
              Region: region,
              Key: obj.Key,
            },
            (err, data) => {
              if (err) reject(err);
              else resolve(data.Body.toString("utf-8"));
            }
          );
        });

        if (!content || !content.trim()) continue;

        const fileName = path.basename(obj.Key);
        const data = {
          id: v4(),
          url: `cos://${bucket}/${obj.Key}`,
          title: fileName,
          docAuthor: bucket,
          description: `腾讯云 COS 文件: ${obj.Key}`,
          docSource: `Tencent COS ${bucket}`,
          chunkSource: generateChunkSource(
            {
              key: obj.Key,
              secretId,
              secretKey,
              bucket,
              region,
            },
            response.locals.encryptionWorker
          ),
          published: obj.LastModified
            ? new Date(obj.LastModified).toLocaleString()
            : new Date().toLocaleString(),
          wordCount: content.split(" ").length,
          pageContent: content,
          token_count_estimate: tokenizeString(content),
        };

        console.log(`[Tencent COS Loader]: Saving ${fileName} to ${outFolder}`);

        const sanitizedName = sanitizeFileName(
          `${slugify(fileName.replace(/\.[^/.]+$/, ""))}-${data.id}`
        );
        writeToServerDocuments({
          data,
          filename: sanitizedName,
          destinationOverride: outFolderPath,
        });

        processedCount++;
      } catch (err) {
        console.error(
          `[Tencent COS Loader]: Error processing ${obj.Key}:`,
          err.message
        );
      }
    }

    if (processedCount === 0) {
      return {
        success: false,
        reason: "无法处理存储桶中的任何文件。",
      };
    }

    return {
      success: true,
      reason: null,
      data: {
        bucket,
        processedCount,
        destination: outFolder,
      },
    };
  } catch (e) {
    console.error("[Tencent COS Loader] Error:", e);
    return {
      success: false,
      reason: e.message || "连接腾讯云 COS 失败。",
    };
  }
}

/**
 * Generate the full chunkSource for a specific COS file so that we can resync it later.
 * @param {object} chunkSourceInformation
 * @param {import("../../EncryptionWorker").EncryptionWorker} encryptionWorker
 * @returns {string}
 */
function generateChunkSource(
  { key, secretId, secretKey, bucket, region },
  encryptionWorker
) {
  const payload = {
    key,
    secretId,
    secretKey,
    bucket,
    region,
  };
  return `cos://${bucket}/${key}?payload=${encryptionWorker.encrypt(
    JSON.stringify(payload)
  )}`;
}

/**
 * Fetch content from a specific COS file for resync
 */
async function fetchCOSFile({ key, secretId, secretKey, bucket, region }) {
  if (!secretId || !secretKey || !bucket || !region || !key) {
    return {
      success: false,
      content: null,
      reason: "缺少必需的 COS 凭证或文件信息。",
    };
  }

  try {
    const cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });

    const content = await new Promise((resolve, reject) => {
      cos.getObject(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
        },
        (err, data) => {
          if (err) reject(err);
          else resolve(data.Body.toString("utf-8"));
        }
      );
    });

    return {
      success: true,
      content,
      reason: null,
    };
  } catch (e) {
    return {
      success: false,
      content: null,
      reason: e.message || "获取 COS 文件失败。",
    };
  }
}

module.exports = {
  loadTencentCOS,
  fetchCOSFile,
};
