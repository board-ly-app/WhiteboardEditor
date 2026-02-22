// -- third-party imports
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// -- local imports
import {
  isIPermanentUser,
  ITempUserPublicView,
  type IUserType,
  User,
} from '../models/User';
import mongoose from 'mongoose';

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

export const permanentUserLoginService = async (
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

export type CreateTempUserRes =
  | { 
      status: 'missing_env'; 
      envVar: string; 
    }
  | {
      status: 'unexpected_error';
      message: string
    }
  | { 
      status: 'ok'; 
      payload: { 
        user: ITempUserPublicView, 
        accessToken: string, 
        refreshToken: string 
      }; 
    }
;

export const tempUserLoginService = async (): Promise<CreateTempUserRes> => {
  try{
    const tempUserId = new mongoose.Types.ObjectId();
    const tempUsername = `TempUser${tempUserId.toHexString()}`;
    const expirationTime = process.env.TEMP_USER_EXPIRATION_SECS;
    if (!expirationTime) {
      console.error("TEMP_USER_EXPIRATION_SECS not defined in env.");
      return {
        status: 'missing_env',
        envVar: 'TEMP_USER_EXPIRATION_SECS'
      }
    }
  
    const tempUser = new User({
      _id: tempUserId,
      username: tempUsername,
      kind: 'temp',
      tempExpiresAt: new Date(Date.now() + 1000 * parseInt(expirationTime))
    });
  
    const saved = await tempUser.save();
  
    const accessToken = jwt.sign(
      { userId: saved._id, isTemp: true },
      JWT_SECRET,
      { expiresIn: "15m" }
    );
  
    const refreshToken = jwt.sign(
      { userId: saved._id, isTemp: true },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
  
    return {
      status: 'ok',
      payload: {
        user: saved.toPublicView() as ITempUserPublicView,
        accessToken,
        refreshToken
      }  
    };
  } catch (e: any) {
    console.error("Unexpected error: ", e);
    return {
      status: 'unexpected_error',
      message: `${e}`
    }
  }
};