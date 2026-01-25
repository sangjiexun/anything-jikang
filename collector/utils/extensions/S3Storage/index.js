const fs = require("fs");
const path = require("path");
const { default: slugify } = require("slugify");
const { v4 } = require("uuid");
const { writeToServerDocuments, sanitizeFileName } = require("../../files");
const { tokenizeString } = require("../../tokenizer");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

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
 * Load documents from AWS S3 or S3-compatible storage
 * @param {object} args - forwarded request body params
 * @param {import("../../../middleware/setDataSigner").ResponseWithSigner} response - Express response object with encryptionWorker
 * @returns
 */
async function loadS3Storage(
  {
    endpoint = null,
    region = "us-east-1",
    accessKeyId = null,
    secretAccessKey = null,
    bucket = null,
    prefix = "",
  },
  response
) {
  if (!accessKeyId || !secretAccessKey) {
    return {
      success: false,
      reason: "Access Key ID and Secret Access Key are required.",
    };
  }

  if (!bucket) {
    return {
      success: false,
      reason: "Bucket name is required.",
    };
  }

  console.log(`-- Working S3 Storage: ${bucket} --`);

  try {
    const clientConfig = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // Support custom endpoints for S3-compatible storage (MinIO, etc.)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const s3Client = new S3Client(clientConfig);

    // List objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (!objects.length) {
      return {
        success: false,
        reason: "No objects found in the specified bucket/prefix.",
      };
    }

    // Filter for supported file types
    const supportedObjects = objects.filter((obj) => {
      const ext = path.extname(obj.Key || "").toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && obj.Size > 0;
    });

    if (!supportedObjects.length) {
      return {
        success: false,
        reason: `No supported files found. Supported extensions: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      };
    }

    const outFolder = slugify(`s3-${bucket}-${v4().slice(0, 4)}`).toLowerCase();
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
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: obj.Key,
        });

        const getResponse = await s3Client.send(getCommand);
        const content = await streamToString(getResponse.Body);

        if (!content || !content.trim()) continue;

        const fileName = path.basename(obj.Key);
        const data = {
          id: v4(),
          url: `s3://${bucket}/${obj.Key}`,
          title: fileName,
          docAuthor: bucket,
          description: `S3 file: ${obj.Key}`,
          docSource: `S3 ${bucket}`,
          chunkSource: generateChunkSource(
            {
              key: obj.Key,
              endpoint,
              region,
              accessKeyId,
              secretAccessKey,
              bucket,
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

        console.log(`[S3 Loader]: Saving ${fileName} to ${outFolder}`);

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
        console.error(`[S3 Loader]: Error processing ${obj.Key}:`, err.message);
      }
    }

    if (processedCount === 0) {
      return {
        success: false,
        reason: "No files could be processed from the bucket.",
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
    console.error("[S3 Loader] Error:", e);
    return {
      success: false,
      reason: e.message || "Failed to connect to S3 storage.",
    };
  }
}

/**
 * Convert a readable stream to string
 * @param {ReadableStream} stream
 * @returns {Promise<string>}
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Generate the full chunkSource for a specific S3 file so that we can resync it later.
 * @param {object} chunkSourceInformation
 * @param {import("../../EncryptionWorker").EncryptionWorker} encryptionWorker
 * @returns {string}
 */
function generateChunkSource(
  { key, endpoint, region, accessKeyId, secretAccessKey, bucket },
  encryptionWorker
) {
  const payload = {
    key,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
  return `s3://${bucket}/${key}?payload=${encryptionWorker.encrypt(
    JSON.stringify(payload)
  )}`;
}

/**
 * Fetch content from a specific S3 file for resync
 */
async function fetchS3File({
  key,
  endpoint,
  region,
  accessKeyId,
  secretAccessKey,
  bucket,
}) {
  if (!accessKeyId || !secretAccessKey || !bucket || !key) {
    return {
      success: false,
      content: null,
      reason: "Missing required S3 credentials or file information.",
    };
  }

  try {
    const clientConfig = {
      region: region || "us-east-1",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    const s3Client = new S3Client(clientConfig);
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const getResponse = await s3Client.send(getCommand);
    const content = await streamToString(getResponse.Body);

    return {
      success: true,
      content,
      reason: null,
    };
  } catch (e) {
    return {
      success: false,
      content: null,
      reason: e.message || "Failed to fetch S3 file.",
    };
  }
}

module.exports = {
  loadS3Storage,
  fetchS3File,
};
