const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const prisma = new PrismaClient();

async function main() {
  const settings = [
    { label: "multi_user_mode", value: "true" }, // 默认启用多用户模式
    { label: "logo_filename", value: "anything-llm.png" },
  ];

  for (let setting of settings) {
    const existing = await prisma.system_settings.findUnique({
      where: { label: setting.label },
    });

    // Only create the setting if it doesn't already exist
    if (!existing) {
      await prisma.system_settings.create({
        data: setting,
      });
    } else if (setting.label === "multi_user_mode" && existing.value === "false") {
      // 确保多用户模式已启用
      await prisma.system_settings.update({
        where: { label: setting.label },
        data: { value: "true" },
      });
    }
  }

  // 创建默认管理员用户（如果不存在）
  const adminUsername = "admin";
  const adminPassword = "admin123"; // 默认密码，建议首次登录后修改

  const existingAdmin = await prisma.users.findFirst({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    await prisma.users.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        role: "admin",
        seen_recovery_codes: true, // 跳过恢复代码提示
      },
    });
    console.log(`创建默认管理员用户: ${adminUsername} / ${adminPassword}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
