import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma.js';
import { AppError } from '../../shared/errors.js';
import { signToken } from '../../middleware/auth.js';

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
  }
  const safeUser = { id: user.id, email: user.email, role: user.role };
  return { token: signToken(safeUser), user: safeUser };
}
