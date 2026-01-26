const bcrypt = require("bcryptjs");

const storedHash = "$2b$10$1JHE71EWT2H/RxbO9PdSdO0W4XljK2ij1H1B0iXhPIyih3ss8M2P.";
const testPassword = "admin123";

const isMatch = bcrypt.compareSync(testPassword, storedHash);
console.log(`Password "admin123" matches: ${isMatch}`);

// 测试其他密码
console.log(`Password "test" matches: ${bcrypt.compareSync("test", storedHash)}`);
console.log(`Password "admin" matches: ${bcrypt.compareSync("admin", storedHash)}`);
