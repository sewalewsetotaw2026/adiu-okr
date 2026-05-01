import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (
  id: string,
  company_id: string,
  role_id: string,
): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN
      ? String(process.env.JWT_EXPIRES_IN)
      : "1d") as any,
  };
  return jwt.sign(
    { id, company_id, role_id },
    process.env.JWT_SECRET as jwt.Secret,
    options,
  );
};

export const verifyToken = (token: string): any => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  return jwt.verify(token, process.env.JWT_SECRET);
};

import crypto from "crypto";

export const createPasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  return { resetToken, passwordResetToken };
};
