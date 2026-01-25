import { useState } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";

export default function S3StorageOptions() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    try {
      setLoading(true);
      showToast(
        "正在从 S3 存储桶获取文件 - 这可能需要一些时间。",
        "info",
        {
          clear: true,
          autoClose: false,
        }
      );
      const { data, error } = await System.dataConnectors.s3Storage.collect({
        endpoint: form.get("endpoint") || null,
        region: form.get("region"),
        accessKeyId: form.get("accessKeyId"),
        secretAccessKey: form.get("secretAccessKey"),
        bucket: form.get("bucket"),
        prefix: form.get("prefix") || "",
      });

      if (!!error) {
        showToast(error, "error", { clear: true });
        setLoading(false);
        return;
      }

      showToast(
        `成功从 S3 存储桶 ${data.bucket} 收集了 ${data.processedCount} 个文件。输出文件夹: ${data.destination}`,
        "success",
        { clear: true }
      );
      e.target.reset();
      setLoading(false);
    } catch (e) {
      console.error(e);
      showToast(e.message, "error", { clear: true });
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full">
      <div className="flex flex-col w-full px-1 md:pb-6 pb-16">
        <form className="w-full" onSubmit={handleSubmit}>
          <div className="w-full flex flex-col py-2">
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    自定义端点 (可选)
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    用于 S3 兼容存储服务 (如 MinIO, Cloudflare R2 等)。留空则使用 AWS S3。
                  </p>
                </div>
                <input
                  type="url"
                  name="endpoint"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="例如: https://s3.example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    区域 (Region)
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    S3 存储桶所在的区域。
                  </p>
                </div>
                <input
                  type="text"
                  name="region"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="例如: us-east-1, ap-southeast-1"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                  defaultValue="us-east-1"
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    Access Key ID
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    用于访问 S3 的凭证 Access Key ID。
                  </p>
                </div>
                <input
                  type="text"
                  name="accessKeyId"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    Secret Access Key
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    用于访问 S3 的凭证 Secret Access Key。
                  </p>
                </div>
                <input
                  type="password"
                  name="secretAccessKey"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    存储桶名称
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    要导入文件的 S3 存储桶名称。
                  </p>
                </div>
                <input
                  type="text"
                  name="bucket"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="my-bucket"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    前缀/路径 (可选)
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    只导入指定前缀下的文件。留空则导入整个存储桶。
                  </p>
                </div>
                <input
                  type="text"
                  name="prefix"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="例如: documents/, data/2024/"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 w-full pr-10">
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full justify-center border-none px-4 py-2 rounded-lg text-dark-text light:text-white text-sm font-bold items-center flex gap-x-2 bg-theme-home-button-primary hover:bg-theme-home-button-primary-hover disabled:bg-theme-home-button-primary-hover disabled:cursor-not-allowed"
            >
              {loading ? "正在收集文件..." : "提交"}
            </button>
            {loading && (
              <p className="text-xs text-theme-text-secondary">
                正在从 S3 存储桶获取文件并处理，请稍候...
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
