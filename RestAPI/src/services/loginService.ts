// -- third-party imports
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
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRATION_SECS = parseInt(process.env?.JWT_EXPIRATION_SECS ?? '');

if (! JWT_SECRET) {
  throw new Error('Missing required env var JWT_SECRET');
}

if (! JWT_EXPIRATION_SECS) {
  throw new Error('Missing required env var JWT_EXPIRATION_SECS');
}

export interface LoginPermanentUserOkRes {
  kind: 'ok';
  user: IPermanentUser;
  token: string;
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
    const token = jwt.sign(
      { sub: userId.toString() },   // sub = subject claim
      JWT_SECRET, 
      {
        algorithm: 'HS256',
        expiresIn: JWT_EXPIRATION_SECS,
      },
    );

    return ({
      kind: 'ok',
      token,
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

    // unique name is found
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
      createdAt: new Date(Date.now()),
    });
  
    const saved = await tempUser.save();
  
    const accessToken = jwt.sign(
      { 
        sub: saved._id.toString(),
        isTemp: true
      },
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
};
