// -- third-party imports
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// -- local imports
import {
  isIPermanentUser,
  type IUserType,
  User,
} from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRATION_SECS = parseInt(process.env.JWT_EXPIRATION_SECS || '');

if (! JWT_SECRET) {
  console.error('Missing required env var JWT_SECRET');
  process.exit(1);
}

if (! JWT_EXPIRATION_SECS) {
  console.error('Missing required env var JWT_EXPIRATION_SECS');
  process.exit(1);
}

// TODO: copy and rewrite for temp users
export const loginService = async (
  authSource: 'email' | 'username',
  identifier: string,
  password: string,
) => {
  // Find user by email or username
  const user: IUserType | null = await (async () => {
    switch (authSource) {
      case 'email':
        return await User.findOne({ email: identifier });
      case 'username':
        return await User.findOne({ username: identifier });
      default:
        return null;
    }
  })();

  if (!user) throw new Error("Invalid credentials, user not found");

  const userId = user._id;

  if (!isIPermanentUser(user)) throw new Error("User is not permanent");

  // Check password
  if (!user.passwordHashed) throw new Error("Error: User does not have password");
  const valid = await bcrypt.compare(password, user.passwordHashed);
  if (!valid) throw new Error("Invalid credentials, incorrect password");

  // Sign JWT
  const token = jwt.sign(
    { sub: userId.toString() },   // sub = subject claim
    JWT_SECRET, 
    {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRATION_SECS,
    },
  );

  return ({
    token,
    user: user.toPublicView()
  });
}
