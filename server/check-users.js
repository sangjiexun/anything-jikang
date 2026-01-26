const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany();
  console.log("Users in database:");
  console.log(JSON.stringify(users, null, 2));
  
  const settings = await prisma.system_settings.findMany();
  console.log("\nSystem settings:");
  console.log(JSON.stringify(settings, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
