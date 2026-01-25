import { useState } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";

export default function TencentCOSOptions() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    try {
      setLoading(true);
      showToast(
        "正在从腾讯云 COS 存储桶获取文件 - 这可能需要一些时间。",
        "info",
        {
          clear: true,
          autoClose: false,
        }
      );
      const { data, error } = await System.dataConnectors.tencentCOS.collect({
        secretId: form.get("secretId"),
        secretKey: form.get("secretKey"),
        bucket: form.get("bucket"),
        region: form.get("region"),
        prefix: form.get("prefix") || "",
      });

      if (!!error) {
        showToast(error, "error", { clear: true });
        setLoading(false);
        return;
      }

      showToast(
        `成功从腾讯云 COS 存储桶 ${data.bucket} 收集了 ${data.processedCount} 个文件。输出文件夹: ${data.destination}`,
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
                    SecretId
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    腾讯云 API 密钥的 SecretId。可在
                    <a
                      href="https://console.cloud.tencent.com/cam/capi"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-button underline ml-1"
                    >
                      腾讯云控制台
                    </a>
                    获取。
                  </p>
                </div>
                <input
                  type="text"
                  name="secretId"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="请输入您的 SecretId"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    SecretKey
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    腾讯云 API 密钥的 SecretKey。
                  </p>
                </div>
                <input
                  type="password"
                  name="secretKey"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    存储桶名称 (Bucket)
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    完整的存储桶名称，格式为 bucket-appid，例如: my-bucket-1250000000
                  </p>
                </div>
                <input
                  type="text"
                  name="bucket"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="my-bucket-1250000000"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    地域 (Region)
                  </label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    存储桶所在的地域，例如: ap-guangzhou, ap-shanghai, ap-beijing 等。
                  </p>
                </div>
                <input
                  type="text"
                  name="region"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="ap-guangzhou"
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
                正在从腾讯云 COS 存储桶获取文件并处理，请稍候...
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
