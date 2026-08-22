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
  AccountConfirmationTemplate,
  AccountConfirmationDuplicateEmailTemplate,
  PatchAccountEmailTemplate,
} from '../services/emailService';

import {
  generateCsrfToken,
} from '../services/csrfProtectionService';

import {
  isAuthTempConversionPayload,
} from '../services/whiteboardService';

import {
  SetInclusionOptionType,
} from '../utils';

import {
  getUserById,
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
  type IPermanentUser,
  type IPermanentUserSelfView,
  type ConfirmPermanentUserPayload,
  type ConvertTempUserReqBody,
  type PatchPermanentUserReqPayloadSigned,
  type PatchPermanentUserConfirmReqBody,
  type PatchPermanentUserPendingConfirmationResBody,
  type PatchPermanentUserConfirmedResBody,
  type DeletePermanentUserReqBody,
  type CreatePermanentUserReqBody,
  type PatchPermanentUserInitialReqBody,
  User,
  isIPermanentUser,
  isCreatePermanentUserReqBody,
  isCreatePermanentUserNoEmailReqBody,
  isConfirmPermanentUserReqBody,
  isConfirmPermanentUserPayload,
  isPatchPermanentUserReqBody,
  isPatchPermanentUserReqPayloadSigned,
} from "../models/User";

import {
  type IWhiteboardPermissionEnum,
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

const {
  DOMAIN_NAME,
  EMAIL_DOMAIN_NAME,
  EMAIL_VERIFICATION_SECRET,
  EMAIL_VERIFICATION_EXPIRATION_SECS: S_EMAIL_VERIFICATION_EXPIRATION_SECS,
} = process.env;

if (! DOMAIN_NAME) throw new Error('Env var DOMAIN_NAME not provided');
if (! EMAIL_DOMAIN_NAME) throw new Error('Env var EMAIL_DOMAIN_NAME not provided');
if (! EMAIL_VERIFICATION_SECRET) {
  throw new Error('Env var EMAIL_VERIFICATION_SECRET not provided');
}
if (! S_EMAIL_VERIFICATION_EXPIRATION_SECS) {
  throw new Error('Env var EMAIL_VERIFICATION_EXPIRATION_SECS not provided');
}

const EMAIL_VERIFICATION_EXPIRATION_SECS = parseInt(S_EMAIL_VERIFICATION_EXPIRATION_SECS);

if (Number.isNaN(EMAIL_VERIFICATION_EXPIRATION_SECS)) {
  throw new Error('Env var EMAIL_VERIFICATION_EXPIRATION_SECS not a valid number');
}

const SHOULD_SKIP_EMAIL_VERIFICATION : boolean = (() => {
  const {
    SKIP_EMAIL_VERIFICATION,
  } = process.env;

  if (! SKIP_EMAIL_VERIFICATION) {
    throw new Error('Env var SKIP_EMAIL_VERIFICATION not provided');
  }

  switch (SKIP_EMAIL_VERIFICATION) {
    case 'TRUE':
      return true;
    case 'FALSE':
      return false;
    default:
      throw new Error(`Unrecognized value "${SKIP_EMAIL_VERIFICATION}" for env var SKIP_EMAIL_VERIFICATION`);
  }// -- end switch (SKIP_EMAIL_VERIFICATION)
})();

// -- POST /users works differently based on whether email verification is
// turned on or off. When email verificatio nis enabled, the endpoint sends
// email to the email address provided by the user, including a signed jwt the
// form enclosed in the email will use to confirm account creation.
export const {
  handleCreateUser,
  handleConfirmUser,
} = (() => {
  // -- Validate new user, sending an error response if user data invalid
  const isNewUserValid = async (
    req: CreatePermanentUserReqBody,
    res: Response,
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
        password,
      } = req.body;
      const payload : unknown = jwt.verify(token, EMAIL_VERIFICATION_SECRET);

      if (! isConfirmPermanentUserPayload(payload)) {
        return res.status(400).json({
          message: "Malformed request body",
        });
      }

      const { email, username, } = payload;
      const passwordHashed = await bcrypt.hash(password, 10);
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

  if (SHOULD_SKIP_EMAIL_VERIFICATION) {
    // -- Immediately create account and log user in
    const handleCreateUser = async (
      req: Request,
      res: Response,
    ) => {
      try {
        if (! isCreatePermanentUserNoEmailReqBody(req.body)) {
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
  } else {
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

        const { email, username, whiteboardConversionRequest, } = req.body;

        // --- Check for existing user ---
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          const resp : PostUserRouteBadRequestErrRes = ({
            message: "Username already in use.",
          });
          return res.status(400).json(resp);
        }

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
          action: "POST:/users", email, username,
        });
        const token = jwt.sign(payload, EMAIL_VERIFICATION_SECRET, {
          algorithm: 'HS256',
          expiresIn: EMAIL_VERIFICATION_EXPIRATION_SECS,
        });

        // -- We don't want users to be able to use this endpoint to detect
        // whether a user with the given email address exists; if user with
        // given email address already exists, just send an email indicating
        // that an account with this email address already exists. In either
        // case, send the client the same 201 success response.
        const existingEmail = await User.findOne({ email });

        if (existingEmail) {
          const emailSubject = `Someone tried to create a new account at ${DOMAIN_NAME}`;
          const emailText = `You are receiving this email because someone tried to create a new account at ${DOMAIN_NAME} with this email address.${"\n\n"}If you want to access the account you already created, please go to ${DOMAIN_NAME} to request a new password. Otherwise, you can disregard this email.`;
          const emailBody = AccountConfirmationDuplicateEmailTemplate({
            domainName: DOMAIN_NAME,
            username: existingEmail.username,
          });

          transporter.sendMail({
            from: `"Board-ly" <admin@${EMAIL_DOMAIN_NAME}>`,
            to: email,
            subject: emailSubject,
            text: emailText,
            html: emailBody.toString(),
          })
          .then((info) => {
            console.log('Message sent to %s:', email, info.messageId);
          })
          .catch((e: unknown) => {
            console.error('Failed to send email to %s:', email, e);
          });
        } else {
          // -- Send verification email
          const emailSubject = `Please confirm your account at ${DOMAIN_NAME}`;
          const emailText = `Hello ${username},${"\n\n"}Please copy/paste the following token into the form at https://${DOMAIN_NAME}/confirm_account_creation to finish creating your new account.${"\n\n"}Token:${"\n"}${token}`;
          const emailBody = AccountConfirmationTemplate({
            domainName: DOMAIN_NAME,
            username,
            accountCreationToken: token,
            expirationSecs: EMAIL_VERIFICATION_EXPIRATION_SECS,
            whiteboardToTransfer: whiteboardId && whiteboardConversionRequest && ({
              whiteboardId,
              whiteboardConversionToken: whiteboardConversionRequest,
            }) || undefined
          });

          transporter.sendMail({
            from: `"Board-ly" <admin@${EMAIL_DOMAIN_NAME}>`,
            to: email,
            subject: emailSubject,
            text: emailText,
            html: emailBody.toString(),
          })
          .then((info) => {
            console.log('Message sent to %s:', email, info.messageId);
          })
          .catch((e: unknown) => {
            console.error('Failed to send email to %s:', email, e);
          });
        }

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
export const handlePatchOwnUserInitial = async (
  req: AuthorizedRequest<{}, {}, PatchPermanentUserInitialReqBody>,
  res: AuthorizedResponse,
  targetUser: IPermanentUser,
) => {
  try {
    const {
      payload,
    } = req.body;
    const {
      password,
      ...payloadBase
    } = payload;

    if (SHOULD_SKIP_EMAIL_VERIFICATION || ! (payload.email || password)) {
      // -- Just immediately update the user; no sensitive fields to update
      const update = Object.fromEntries(
        Object.entries(payload).filter(([_k, v]) => v)
      );

      targetUser.set(update);
      const updatedUser = await targetUser.save();
      const resp : PatchPermanentUserConfirmedResBody = ({
        kind: 'confirmed',
        payload: {
          email: updatedUser.email,
          username: updatedUser.username,
        },
      });

      return res.status(201).json(resp);
    } else {
      const email = payload?.email ?? targetUser.email;
      const passwordHashed : string | undefined = password ?
        await bcrypt.hash(password, 10)
        : undefined;

      // -- Create a signed payload to allow the user to confirm the update via
      // email
      const payloadSignedData : PatchPermanentUserReqPayloadSigned = ({
        ...payloadBase,
        action: 'PATCH:/users',
        userId: targetUser._id.toHexString(),
        passwordHashed,
      });
      const payloadSigned : string = jwt.sign(
        payloadSignedData,
        EMAIL_VERIFICATION_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: EMAIL_VERIFICATION_EXPIRATION_SECS,
        }
      );
      const emailBody = PatchAccountEmailTemplate({
        domainName: DOMAIN_NAME,
        username: targetUser.username,
        expirationSecs: EMAIL_VERIFICATION_EXPIRATION_SECS,
        payloadToken: payloadSigned,
        payloadInitial: payload,
      });

      transporter.sendMail({
        from: `"Board-ly" <admin@${EMAIL_DOMAIN_NAME}>`,
        to: email,
        subject: `Confirm your account update at ${DOMAIN_NAME}`,
        // TODO: text version
        html: emailBody.toString(),
      })
        .then((info) => {
          console.log('Message sent to %s:', email, info.messageId);
        })
        .catch((e: unknown) => {
          console.error('Failed to send email to %s:', email, e);
        });

      const resp : PatchPermanentUserPendingConfirmationResBody = ({
        kind: 'pending_confirmation',
        email,
      });

      return res.status(201).json(resp);
    }
  } catch (e: unknown) {
    if (IS_DEVELOPMENT) {
      console.error('Unexpected error on PATCH /users:', e);
    } else {
      console.error('Unexpected error on PATCH /users');
    }

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
};// -- end handlePatchOwnUserInitial

export const handlePatchOwnUserConfirm = async (
  req: AuthorizedRequest<{}, {}, PatchPermanentUserConfirmReqBody>,
  res: AuthorizedResponse,
  targetUser: IPermanentUser,
) => {
  try {
    const {
      authUser,
    } = res.locals;
    const {
      payload,
    } = req.body;

    const payloadData : unknown = jwt.verify(payload, EMAIL_VERIFICATION_SECRET);
    if (! isPatchPermanentUserReqPayloadSigned(payloadData)) {
      return res.status(400).json({
        message: 'Invalid confirmation token',
      });
    }

    if (authUser._id.toHexString() !== payloadData.userId) {
      return res.status(403).json({
        message: 'You are not authorized to perform this action',
      });
    }

    const update = Object.fromEntries(
      Object.entries(payloadData).filter(([_k, v]) => v)
    );

    targetUser.set(update);
    const updatedUser = await targetUser.save();
    const resp : PatchPermanentUserConfirmedResBody = ({
      kind: 'confirmed',
      payload: {
        email: updatedUser.email,
        username: updatedUser.username,
      },
    });

    return res.status(201).json(resp);
  } catch (e: unknown) {
    if (e instanceof jwt.TokenExpiredError) {
      return res.status(400).json({
        message: 'Expired confirmation token',
      });
    } else if (e instanceof jwt.JsonWebTokenError) {
      return res.status(400).json({
        message: 'Invalid confirmation token',
      });
    } else {
      return res.status(500).json({
        message: 'Internal server error',
      });
    }
  }
};// -- end handlePatchOwnUserConfirm

export const handlePatchOwnUser = async (
  req: AuthorizedRequest,
  res: AuthorizedResponse,
) => {
  if (! isPatchPermanentUserReqBody(req.body)) {
    return res.status(400).json({
      message: 'Malformed request body',
    });
  }
  const {
    authUser,
  } = res.locals;

  // -- Fetch the user from the database
  const getUserResp = await getUserById(authUser._id);
  let targetUser : IPermanentUser;

  switch (getUserResp.status) {
    case 'bad_request':
      return res.status(500).json({
        message: 'Internal server error',
      });
    case 'not_found':
      return res.status(400).json({
        message: 'User not found',
      });
    case 'ok':
      switch (getUserResp.user.kind) {
        case 'temp':
          return res.status(403).json({
            message: 'Temporary users may not edit their acccounts',
          });
        case 'permanent':
          targetUser = getUserResp.user;
      }// -- end switch (getUserResp.user.kind)
  }// -- end switch (getUserResp.status)

  switch (req.body.kind) {
    case 'initial':
      return await handlePatchOwnUserInitial(req, res, targetUser);
    case 'confirm':
      return await handlePatchOwnUserConfirm(req, res, targetUser);
  }// -- end switch (req.body.kind)
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
