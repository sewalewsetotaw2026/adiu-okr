
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
// import { createPasswordResetToken } "src/utils/auth"; // Hard to import if path issues, will copy logic

const prisma = new PrismaClient();

const createToken = () => {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  return { resetToken, passwordResetToken };
};

async function main() {
  // Find a user to attach token to
  const user = await prisma.appUser.findFirst();
  if (!user) {
    console.error("No users found to test with.");
    process.exit(1);
  }

  const { resetToken, passwordResetToken } = createToken();

  console.log(`Creating reset token for user ${user.id} (${user.email})`);
  console.log(`Reset Token (Public): ${resetToken}`);
  console.log(`Token Hash (DB): ${passwordResetToken}`);

  await prisma.passwordReset.create({
    data: {
      user_id: user.id,
      token_hash: passwordResetToken,
      expires_at: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
    },
  });

  console.log("Token created successfully.");
  console.log(`Test Command: curl -X PATCH -H "Content-Type: application/json" -d '{"password":"newpassword123"}' http://localhost:5000/api/v1/auth/resetPassword/${resetToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
