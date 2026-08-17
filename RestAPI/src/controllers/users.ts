// -- std imports
import {
  Request,
  Response,
} from "express";

// -- third-party imports
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import {
  Types,
} from 'mongoose';

// -- local imports
import {
  IS_DEVELOPMENT,
} from '../app.config';

import {
  transporter,
} from '../services/mailTransporter';

import {
  generateCsrfToken,
} from '../services/csrfProtectionService';

import {
  isAuthTempConversionPayload,
} from '../services/whiteboardService';

import {
  SetInclusionOptionType,
  escapeEncode,
} from '../utils';

import {
  getUserById,
  patchUser,
  deleteUser,
  getSharedWhiteboardsByUser,
  isUserOwnerCollaborator,
} from "../services/userService";

import {
  loginPermanentUser,
  forceLoginPermanentUser,
  loginTempUser,
  setRefreshTokenCookie,
  setAccessTokenCookie,
} from '../services/authService';

import {
  type AuthorizedRequest,
  type AuthorizedResponse,
} from "../models/Auth";

import {
  type IPermanentUserSelfView,
  type ConfirmPermanentUserPayload,
  type ConvertTempUserReqBody,
  type PatchPermanentUserReqBody,
  type DeletePermanentUserReqBody,
  User,
  isIPermanentUser,
  CreatePermanentUserReqBody,
  isCreatePermanentUserReqBody,
  isConfirmPermanentUserReqBody,
  isConfirmPermanentUserPayload,
} from "../models/User";

import {
  type IWhiteboardPermissionEnum,
  Whiteboard,
} from '../models/Whiteboard';

interface PostUserRouteBadRequestErrRes {
  message: string;
}

interface PostUserRouteServerErrRes {
  message: 'An unexpected error occurred';
}

interface PostUserRouteOkEmailRes {
  kind: 'email';
  email: string;
  message: 'Check your email to confirm account creation';
}

interface PostUserRouteOkNoEmailRes {
  kind: 'no_email';
  user: IPermanentUserSelfView;
  sessionToken: string;
}

// -- POST /users works differently based on whether email verification is
// turned on or off. When email verificatio nis enabled, the endpoint sends
// email to the email address provided by the user, including a signed jwt the
// form enclosed in the email will use to confirm account creation.
export const {
  handleCreateUser,
  handleConfirmUser,
} = (() => {
  const {
    SKIP_EMAIL_VERIFICATION,
    DOMAIN_NAME,
    EMAIL_DOMAIN_NAME,
    EMAIL_VERIFICATION_SECRET,
    EMAIL_VERIFICATION_EXPIRATION_SECS: S_EMAIL_VERIFICATION_EXPIRATION_SECS,
  } = process.env;

  if (! EMAIL_DOMAIN_NAME) throw new Error('Env var EMAIL_DOMAIN_NAME not provided');
  if (! EMAIL_VERIFICATION_SECRET) throw new Error('Env var EMAIL_VERIFICATION_SECRET not provided');
  if (! S_EMAIL_VERIFICATION_EXPIRATION_SECS) {
    throw new Error('Env var EMAIL_VERIFICATION_EXPIRATION_SECS not provided');
  }

  const EMAIL_VERIFICATION_EXPIRATION_SECS = parseInt(S_EMAIL_VERIFICATION_EXPIRATION_SECS);

  if (Number.isNaN(EMAIL_VERIFICATION_EXPIRATION_SECS)) {
    throw new Error('Env var EMAIL_VERIFICATION_EXPIRATION_SECS not a valid number');
  }
  
  // -- Validate new user, sending an error response if user data invalid
  const isNewUserValid = async (
    req: CreatePermanentUserReqBody,
    res: Response
  ): Promise<boolean> => {
    try {
      const { email, username } = req;

      // --- Check for existing user ---
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        const resp : PostUserRouteBadRequestErrRes = ({
          message: "Email already in use.",
        });
        res.status(400).json(resp);
        return false;
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        const resp : PostUserRouteBadRequestErrRes = ({
          message: "Username already in use.",
        });
        res.status(400).json(resp);
        return false;
      }

      return true;
    } catch (e: unknown) {
      if (IS_DEVELOPMENT) {
        console.error('Unexpected error:', e);
      } else {
        console.error('Unexpected error');
      }

      const resp : PostUserRouteServerErrRes = ({
        message: "An unexpected error occurred",
      });
      res.status(500).json(resp);

      return false;
    }
  };// -- end isNewUserValid

  const handleConfirmUser = async (
    req: Request,
    res: Response,
  ) => {
    try {
      if (! isConfirmPermanentUserReqBody(req.body)) {
        return res.status(400).json({
          message: 'Malformed request body',
        });
      }

      const {
        token,
      } = req.body;
      const payload : unknown = jwt.verify(token, EMAIL_VERIFICATION_SECRET);

      if (! isConfirmPermanentUserPayload(payload)) {
        return res.status(400).json({
          message: "Malformed request body",
        });
      }

      const { email, username, passwordHashed } = payload;
      const newUser = new User({
        kind: 'permanent',
        email,
        username,
        passwordHashed,
      });
      await newUser.save();

      // -- Should have created a permanent user
      if (! isIPermanentUser(newUser)) throw new Error('New user not created as permanent');

      // -- Automatically log user in
      const loginResult = forceLoginPermanentUser(newUser);

      switch (loginResult.kind) {
        case 'other_err':
          return res.status(500).json({
            message: 'Unexpected server error',
          });
        case 'ok':
        {
          const sessionToken = generateCsrfToken(req, res);
          const resp : PostUserRouteOkNoEmailRes = ({
            kind: 'no_email',
            user: newUser.toSelfView(),
            sessionToken,
          });

          setRefreshTokenCookie(res, loginResult.refreshToken);
          setAccessTokenCookie(res, loginResult.accessToken);

          return res.status(201).json(resp);
        }
      }// -- end switch (loginResult.kind)
    } catch (e: unknown) {
      if (e instanceof jwt.JsonWebTokenError) {
        return res.status(400).json({
          message: 'Invalid account creation token',
        });
      } else if (e instanceof jwt.TokenExpiredError) {
        return res.status(400).json({
          message: 'Expired account creation token',
        });
      } else {
        if (IS_DEVELOPMENT) {
          console.error('Unexpected server error:', e);
        } else {
          console.error('Unexpected server error');
        }

        return res.status(500).json({
          message: 'Unexpected server error',
        });
      }
    }
  };// -- end handleConfirmUser

  switch (SKIP_EMAIL_VERIFICATION) {
    case 'TRUE':
    {
      // -- Immediately create account and log user in
      const handleCreateUser = async (
        req: Request,
        res: Response,
      ) => {
        try {
          if (! isCreatePermanentUserReqBody(req.body)) {
            return res.status(400).json({
              message: 'Email, username, and password are required',
            });
          }

          if (! isNewUserValid(req.body, res)) {
            return res.end();
          }

          const { email, username, password, } = req.body;
          const passwordHashed = await bcrypt.hash(password, 10);
          
          const user = new User({
            kind: 'permanent',
            username,
            email,
            passwordHashed,
          });

          const newUser = await user.save();

          // --- Automatically log in user via service ---
          if (! isIPermanentUser(newUser)) throw new Error('New user not created as permanent');

          // -- Automatically log user in
          const loginResult = forceLoginPermanentUser(newUser);

          switch (loginResult.kind) {
            case 'other_err':
              return res.status(500).json({
                message: 'Unexpected server error',
              });
            case 'ok':
            {
              const sessionToken = generateCsrfToken(req, res);
              const resp : PostUserRouteOkNoEmailRes = ({
                kind: 'no_email',
                user: newUser.toSelfView(),
                sessionToken,
              });

              setRefreshTokenCookie(res, loginResult.refreshToken);
              setAccessTokenCookie(res, loginResult.accessToken);

              return res.status(201).json(resp);
            }
          }// -- end switch (loginResult.kind)
        } catch (err: any) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Create user failed: ", err);
          } else {
            console.error("Create user failed");
          }

          const resp : PostUserRouteServerErrRes = ({
            message: 'An unexpected error occurred',
          });

          return res.status(500).json(resp);
        }
      };// -- end handleCreateUser

      return ({
        handleConfirmUser,
        handleCreateUser,
      });
    }
    case 'FALSE':
    {
      // -- Create signed jwt containing prospective user info
      const handleCreateUser = async (
        req: Request,
        res: Response,
      ) => {
        try {
          if (! isCreatePermanentUserReqBody(req.body)) {
            return res.status(400).json({
              message: 'Email, username, and password are required',
            });
          }

          if (! isNewUserValid(req.body, res)) return res.end();

          const { email, username, password, whiteboardConversionRequest, } = req.body;
          const passwordHashed = await bcrypt.hash(password, 10);
          const whiteboardId : string | null = (() => {
            if (! whiteboardConversionRequest) return null;

            try {
              const payload : unknown = jwt.decode(whiteboardConversionRequest);

              if (! isAuthTempConversionPayload(payload)) return null;
              return payload.whiteboardId;
            } catch (_e) {
              return null;
            }
          })();

          // -- Create and sign confirmation payload
          const payload : ConfirmPermanentUserPayload = ({
            email, username, passwordHashed,
          });
          const token = jwt.sign(payload, EMAIL_VERIFICATION_SECRET, {
            algorithm: 'HS256',
            expiresIn: EMAIL_VERIFICATION_EXPIRATION_SECS,
          });

          // -- Send verification email; TODO: actually implement form
          const emailSubject = `Please confirm your account at ${DOMAIN_NAME}`;
          const emailText = 'Please submit the form to confirm creation of your account.';

          const emailBody = (
            `<main>
              <h1>Welcome to Board-ly!</h1>

              <p safe>
                Either copy and paste the following token into the previous window
                or click the button below to confirm creation of your account,
                ${escapeEncode(username)}.
              </p>
              <h3>Token:</h3>
              <pre>${escapeEncode(token)}</pre>

              <form method="GET" action="http://${DOMAIN_NAME}/confirm_account_creation">
                <input name="token" value=${encodeURIComponent(token)} type="hidden" />
                ${whiteboardId && (
                  `<input name="wb_conversion_id" value="${encodeURIComponent(whiteboardId)}" type="hidden" />`
                ) || ""}
                ${whiteboardConversionRequest && (
                  `<input name="wb_conversion_req" value="${encodeURIComponent(whiteboardConversionRequest)}" type="hidden" />`
                ) || ""}
                <button type="submit">Create Account</button>
              </form>
            </main>`
          );// -- end const emailBody

          const info = await transporter.sendMail({
            from: `"Board-ly" <admin@${EMAIL_DOMAIN_NAME}>`,
            to: email,
            subject: emailSubject,
            text: emailText,
            html: emailBody,
          });

          console.log('Message sent:', info.messageId);

          // -- Send confirmation response to client
          const resp : PostUserRouteOkEmailRes = ({
            kind: 'email',
            email,
            message: 'Check your email to confirm account creation',
          });

          return res.status(201).json(resp);
        } catch (e: unknown) {
          if (IS_DEVELOPMENT) {
            console.error('Unexpected server error:', e);
          } else {
            console.error('Unexpected server error');
          }

          return res.status(500).json({
            message: "Unexpected server error",
          });
        }
      };// -- end handleCreateUser

      return ({
        handleConfirmUser,
        handleCreateUser,
      });
    }
    default:
      throw new Error('Environment variable SKIP_EMAIL_VERIFICATION must be set to either "TRUE" or "FALSE".');
  }// -- end switch (process.env.SKIP_EMAIL_VERIFICATION)
})();

interface PostConvertTempRouteBadRequestErrRes {
  message: string;
}

interface PostConvertTempRouteServerErrRes {
  message: 'An unexpected error occurred';
}

interface PostConvertTempRouteOkRes {
  token: string;
  user: IPermanentUserSelfView;
}

// === POST /users/convert_temp ================================================
//
// Convert a temporary user account to permanent.
//
// =============================================================================
export const handleConvertTempUser = async (
  req: AuthorizedRequest<{}, {}, ConvertTempUserReqBody>,
  res: AuthorizedResponse,
) => {
  try {
    const { authUser } = res.locals;
    const { email, username, password } = req.body;
    const tempUserIdRaw = authUser?._id;
    if (! Types.ObjectId.isValid(tempUserIdRaw)) {
      const resp : PostConvertTempRouteBadRequestErrRes = ({
        message: "Invalid user id.",
      });
      return res.status(400).json(resp);
    }
    const tempUserId = new Types.ObjectId(tempUserIdRaw);
    
    // --- Hash password ---
    const hashed = await bcrypt.hash(password, 10);

    await User.collection.updateOne(
      { _id: tempUserId },
      { 
        $set: {
          username,
          email,
          kind: 'permanent',
          passwordHashed: hashed,
        },
        $unset: {
          createdAt: ""
        }
      }
    );

    const user = await User.findOne({
      '_id': {
        "$eq": tempUserId
      },
      'kind': 'permanent',
    });

    if (! user) {
      const resp : PostConvertTempRouteBadRequestErrRes = ({
        message: "Could not find temp user to convert.",
      });
      return res.status(400).json(resp);
    }
    
    // --- Automatically log in user via service ---
    try {
      const loginResult = await loginPermanentUser("username", username, password);

      switch (loginResult.kind) {
        case 'other_err':
        // -- If user creation and authentication logic has been implemented properly,
        // the following errors should never occur
          throw loginResult.err;
        case 'no_user':
          throw new Error('No such user found');
        case 'no_perm_user':
          throw new Error('No permanent user found');
        case 'bad_pass':
          throw new Error('Invalid password');
        case 'ok':
        {
          const resp : PostConvertTempRouteOkRes = ({
            user: loginResult.user.toSelfView(),
            token: loginResult.accessToken
          });
          return res.status(201).json(resp);
        }
        default:
          throw new Error(`Unexpected login result: ${JSON.stringify(loginResult)}`);
      }// -- end switch (loginResult.kind)
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Login after signup failed: ", err);   
      } else {
        console.error("Login after signup failed");   
      }

      const resp : PostConvertTempRouteServerErrRes = ({
        message: 'An unexpected error occurred',
      });
      return res.status(500).json(resp)   
    }
    
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Create temp user failed: ", err);   
    } else {
      console.error("Create temp user failed: ");   
    }

    const resp : PostConvertTempRouteServerErrRes = ({
      message: 'An unexpected error occurred',
    });
    return res.status(500).json(resp)   
  }
};// -- end handleConvertTempUser

// === POST /users/temp ========================================================
//
// Create a temporary user account for trial whiteboard use.
//
// =============================================================================
export const handleCreateTempUser = async (
  req: Request,
  res: Response
) => {
  const resp = await loginTempUser();

  switch(resp.status) {
    case 'missing_env':
      return res.status(500).json({ message: resp.envVar });
    case 'unexpected_error':
      return res.status(500).json({ message: resp.message });
    case 'ok':
      {
        const sessionToken = generateCsrfToken(req, res);

        setRefreshTokenCookie(res, resp.payload.refreshToken);
        setAccessTokenCookie(res, resp.payload.accessToken);

        return res.status(201).json({ 
          user: resp.payload.user.toSelfView(),
          sessionToken,
        });
      }
    default:
      throw new Error(`Unhandled case: ${resp}`);
  }
};// -- end handleCreateTempUser

// === GET /users/:userId ======================================================
//
// Fetch the authenticated user's data.
//
// =============================================================================
export const handleGetUserById = async (
  req: AuthorizedRequest<{ userId: Types.ObjectId | 'me'}, any>,
  res: AuthorizedResponse,
) => {
    const { authUser } = res.locals;
    const { _id: authUserId } = authUser;
    const { userId } = req.params;
    const targetUserId = (userId === 'me') ? authUserId : userId;

    const resp = await getUserById(targetUserId);
    
    switch (resp.status) {
      case 'bad_request':
        return res.status(400).json({ message: resp.message });
      case 'not_found':
        return res.status(404).json({ message: `User ${targetUserId} not found` });
      case 'ok':
        if (isUserOwnerCollaborator(authUserId, targetUserId)) {
          // -- Deliver more restricted view
          return res.status(200).json(resp.user.toWBOwnerView());
        } else {
          // -- Deliver more restricted view
          return res.status(200).json(resp.user.toAttribView());
        }
      default:
        throw new Error(`Unhandled case: ${resp}`);
    }
};// -- end handleGetUserById

// === PATCH /users/me =========================================================
//
// Update one or more fields in the authenticated user's data.
//
// =============================================================================
export const handlePatchOwnUser = async (
  req: AuthorizedRequest<{}, any, PatchPermanentUserReqBody>,
  res: AuthorizedResponse,
) => {
  const {
    authUser,
  } = res.locals;
  const patchData: Partial<PatchPermanentUserReqBody> = ({
    ...req.body
  });
  const {
    _id: userId,
  } = authUser;
  const resp = await getUserById(userId);
  
  switch (resp.status) {
      case 'bad_request':
        return res.status(400).json({ message: resp.message });
      case 'not_found':
        return res.status(404).json({ message: `User ${userId} not found` });
      case 'ok':
      {
        const {
          user,
        } = resp;
        
        if (! user) {
          return res.status(400).json({
            message: `Could not find user with id ${userId}`
          });
        } else if (! isIPermanentUser(user)) {
          return res.status(400).json({
            message: `User ${userId} is not permanent`
          })
        } else {
          const origUser = user.toObject();
          const patchUserRes = await patchUser(user, patchData);
        
          if (patchUserRes.type === 'error') {
            return res.status(400).json({ message: patchUserRes.message });
          } else {
            // -- update user permissions if email has been changed
            if (patchUserRes.data.email !== origUser.email) {
              const usersWhiteboards = await Whiteboard.find({
                'user_permissions.user': origUser._id,
              });

              for (const whiteboard of usersWhiteboards) {
                whiteboard.set(
                  'user_permissions',
                  whiteboard.user_permissions.map(perm => {
                    if ((perm.type === 'user') && (perm.user.equals(origUser._id))) {
                      return ({
                        ...perm.toObject(),
                        email: patchUserRes.data.email,
                      });
                    } else {
                      return perm;
                    }
                  })
                );

                await whiteboard.save();
              }// -- end for whiteboard
            }

            return res.status(201).json(patchUserRes.data.toSelfView());
          }
        }
      }
      default:
        throw new Error(`Unhandled case: ${resp}`);
  }
};// -- end handlePatchOwnUser

// === DELETE /users/me ========================================================
//
// Deletes the user's own account.
// 
// =============================================================================
export const handleDeleteOwnUser = async (
  req: AuthorizedRequest<{}, any, DeletePermanentUserReqBody>,
  res: AuthorizedResponse,
) => {
  const {
    authUser,
  } = res.locals;
  const {
    _id: userId,
  } = authUser;
  const {
    password,
  } = req.body;
  const user = await User.findOne({
    '_id': userId,
  });

  if (! user) {
    return res.status(404).json({
      message: 'User not found',
    });
  }

  if (user.kind === 'permanent') {
      // ensure request is authenticated
      if (! password) {
        return res.status(400).json({
          message: 'Password required to delete user',
        });
      } else if (! await bcrypt.compare(password, user.passwordHashed)) {
        return res.status(400).json({
          message: 'Password incorrect',
        });
      }
  }

  const resp = await deleteUser(userId);

  if (resp.result === 'err') {
    return res.status(400).json({ message: resp.err });
  } else {
    return res.status(200).json(resp.data.toSelfView());
  }
};// -- end handleDeleteOwnUser

// === GET /users/:userId:/shared_whiteboards ==================================
//
// Get summaries (attribute views) of all whiteboards shared with a given user.
// If passed "me" as the userId, fetches for the authenticated user.
// By default, spans all permissions.
//
// TODO: implement queries to filter by permission type.
//
// =============================================================================
export const handleGetSharedWhiteboardsByUser = async (
  req: AuthorizedRequest<{ userId: Types.ObjectId | 'me' }, any>,
  res: AuthorizedResponse,
) => {
  const {
    userId,
  } = req.params;
  const {
    authUser,
  } = res.locals;
  const {
    _id: authUserId,
  } = authUser;

  const targetUserId = (userId === 'me') ?
    authUserId
    : userId;
    
  const includeOpts: SetInclusionOptionType<IWhiteboardPermissionEnum> = ({
    type: 'exclude',
    excluded: ['own'],
  });

  const resp = await getSharedWhiteboardsByUser(targetUserId, includeOpts);

  switch (resp.status) {
      case 'server_error':
        return res.status(500).json({ message: 'Unexpected server error' });
      case 'user_not_found':
        // This _shouldn't_ happen in our case, since we've already passed the
        // authentication middleware by this point. Nevertheless, the controller
        // still accounts for the possibility.
        return res.status(403).json({ message: 'Invalid user' });
      case 'bad_request':
        return res.status(400).json({ message: resp.message });
      case 'ok':
        return res.status(200).json(resp.whiteboards);
      default:
        // Shouldn't get here. If we get here, there is a case we haven't
        // accounted for.
        throw new Error(`Unexpected case: ${resp}`);
  }// end switch (resp.status)
};// -- end handleGetSharedWhiteboardsByUser
