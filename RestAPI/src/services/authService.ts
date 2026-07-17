// -- third-party imports
import mongoose, {
  Types,
} from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  uniqueNamesGenerator,
  Config as UniqueNamesConfig,
  adjectives,
  colors,
  animals,
} from 'unique-names-generator';

// -- local imports
import {
  type IUserType,
  type IPermanentUser,
  isIPermanentUser,
  ITempUser,
  User,
} from '../models/User';

import {
  type AccessTokenPayload,
  type RefreshTokenPaylod,
  isAccessTokenPayload,
  isRefreshTokenPayload,
} from '../models/Auth';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;

if (! ACCESS_TOKEN_SECRET) {
  throw new Error('Missing required env var ACCESS_TOKEN_SECRET');
}

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

if (! REFRESH_TOKEN_SECRET) {
  throw new Error('Missing required env var REFRESH_TOKEN_SECRET');
}

const ACCESS_TOKEN_EXPIRATION_SECS = parseInt(process.env?.ACCESS_TOKEN_EXPIRATION_SECS ?? '');

if (! ACCESS_TOKEN_EXPIRATION_SECS) {
  throw new Error('Missing required env var ACCESS_TOKEN_EXPIRATION_SECS');
}

const REFRESH_TOKEN_EXPIRATION_SECS = parseInt(process.env?.REFRESH_TOKEN_EXPIRATION_SECS ?? '');

if (! REFRESH_TOKEN_EXPIRATION_SECS) {
  throw new Error('Missing required env var REFRESH_TOKEN_EXPIRATION_SECS');
}

interface VerifyUserFromAccessTokenInvalidTokenRes {
  kind: 'invalid_token';
}

interface VerifyUserFromAccessTokenMalformedTokenRes {
  kind: 'malformed_token';
}

interface VerifyUserFromAccessTokenNoUserRes {
  kind: 'no_user';
}

interface VerifyUserFromAccessTokenOkRes {
  kind: 'ok';
  user: IUserType;
}

export type VerifyUserFromAccessTokenRes =
  | VerifyUserFromAccessTokenInvalidTokenRes
  | VerifyUserFromAccessTokenMalformedTokenRes
  | VerifyUserFromAccessTokenNoUserRes
  | VerifyUserFromAccessTokenOkRes
;

export const verifyUserFromAccessToken = async (
  token: string
): Promise<VerifyUserFromAccessTokenRes> => {
  try {
    const payload : any = jwt.verify(token, ACCESS_TOKEN_SECRET);

    if (! isAccessTokenPayload(payload)) return { kind: 'malformed_token' };

    const userId = new Types.ObjectId(payload.sub);
    const user = await User.findById(userId);

    if (! user) return { kind: 'no_user' };

    await user.populateAttribs();

    return {
      kind: 'ok',
      user,
    };
  } catch (_err) {
    return { kind: 'invalid_token' };
  }
};// -- end verifyUserFromAccessToken

interface VerifyUserFromRefreshTokenInvalidTokenRes {
  kind: 'invalid_token';
}

interface VerifyUserFromRefreshTokenMalformedTokenRes {
  kind: 'malformed_token';
}

interface VerifyUserFromRefreshTokenNoUserRes {
  kind: 'no_user';
}

interface VerifyUserFromRefreshTokenOkRes {
  kind: 'ok';
  user: IUserType;
}

export type VerifyUserFromRefreshTokenRes =
  | VerifyUserFromRefreshTokenInvalidTokenRes
  | VerifyUserFromRefreshTokenMalformedTokenRes
  | VerifyUserFromRefreshTokenNoUserRes
  | VerifyUserFromRefreshTokenOkRes
;

export const verifyUserFromRefreshToken = async (
  token: string
): Promise<VerifyUserFromRefreshTokenRes> => {
  try {
    const payload : any = jwt.verify(token, REFRESH_TOKEN_SECRET);

    if (! isRefreshTokenPayload(payload)) return ({ kind: 'malformed_token' });

    const userId = new Types.ObjectId(payload.userId);
    const user = await User.findById(userId);

    if (! user) return { kind: 'no_user' };

    await user.populateAttribs();

    return {
      kind: 'ok',
      user,
    };
  } catch (_err) {
    return { kind: 'invalid_token' };
  }
};// -- end verifyUserFromRefreshToken

export const createAccessToken = (userId: Types.ObjectId): string => {
  const payload : AccessTokenPayload = ({
    sub: userId.toString(),
  });
  const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRATION_SECS,
  });

  return token;
};// -- end createAccessToken

export const createRefreshToken = (userId: Types.ObjectId): string => {
  const payload : RefreshTokenPaylod = ({
    kind: 'refresh',
    userId: userId.toHexString(),
  });
  const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_EXPIRATION_SECS,
  });

  return token;
};// -- end createRefreshToken

export interface LoginPermanentUserOkRes {
  kind: 'ok';
  user: IPermanentUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPermanentUserNoUserRes {
  kind: 'no_user';
}

export interface LoginPermanentUserNoPermUserRes {
  kind: 'no_perm_user';
}

export interface LoginPermanentUserBadPassRes {
  kind: 'bad_pass';
}

export interface LoginPermanentUserOtherErrRes {
  kind: 'other_err';
  err: any;
}

export type LoginPermanentUserRes =
  | LoginPermanentUserOkRes
  | LoginPermanentUserNoUserRes
  | LoginPermanentUserNoPermUserRes
  | LoginPermanentUserBadPassRes
  | LoginPermanentUserOtherErrRes
;

export const loginPermanentUser = async (
  authSource: 'email' | 'username',
  identifier: string,
  password: string,
): Promise<LoginPermanentUserRes> => {
  try {
    // Find user by email or username
    const user: IUserType | null = await (async () => {
      switch (authSource) {
        case 'email':
          return await User.findOne({ email: { '$eq': identifier } });
        case 'username':
          return await User.findOne({ username: { '$eq': identifier } });
        default:
          return null;
      }
    })();

    if (! user) return ({ kind: 'no_user' });

    const userId = user._id;

    if (! isIPermanentUser(user)) return ({ kind: 'no_perm_user' });

    // Check password
    if (! user.passwordHashed) throw new Error("Error: User does not have password");

    const valid = await bcrypt.compare(password, user.passwordHashed);
    if (! valid) return ({ kind: 'bad_pass' });

    // Sign JWT
    const accessToken = createAccessToken(userId);
    const refreshToken = createRefreshToken(userId);

    return ({
      kind: 'ok',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err: any) {
    return {
      kind: 'other_err',
      err,
    };
  }
};// -- end loginPermanentUser

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
        user: ITempUser, 
        accessToken: string, 
        refreshToken: string 
      }; 
    }
;

export const loginTempUser = async (): Promise<CreateTempUserRes> => {
  // -- Config for generating random unique names
  const uniqueNamesConfig : UniqueNamesConfig = {
    dictionaries: [adjectives, colors, animals],
    separator: "-",
    length: 3,
    style: 'capital',
  };// -- end uniqueNamesConfig

  try{
    const tempUserId = new mongoose.Types.ObjectId();
    // -- Generate temp user name
    const tempUsernameBase : string = uniqueNamesGenerator(uniqueNamesConfig);

    // -- While temp name already exists, try appending integers until a truly
    const tempUsername : string = await (async () => {
      let username = tempUsernameBase;

      for (let tempUsernameCounter = 2; tempUsernameCounter < 1000; ++tempUsernameCounter) {
        const existingUserWithName = await User.findOne({
          username: {
            "$eq": username,
          },
        });

        if (! existingUserWithName) {
          return username;
        } else {
          username = `${tempUsernameBase}-${tempUsernameCounter}`;
        }
      }// -- end for tempUsernameCounter

      // -- Fall back on "TempUser<User Object ID>"
      return `TempUser-${tempUserId.toHexString()}`;
    })();
  
    const tempUser = new User({
      _id: tempUserId,
      kind: 'temp',
      username: tempUsername,
      createdAt: new Date(Date.now()),
    });
  
    const saved = await tempUser.save();
  
    const accessToken = createAccessToken(tempUserId);
    const refreshToken = createRefreshToken(tempUserId);
  
    return {
      status: 'ok',
      payload: {
        user: saved as ITempUser,
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
};// -- end loginTempUser
