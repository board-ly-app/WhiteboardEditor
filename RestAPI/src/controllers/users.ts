// -- std imports
import {
  Request,
  Response,
} from "express";

// -- third-party imports
import bcrypt from 'bcrypt';

import {
  Types,
} from 'mongoose';

import {
  generateCsrfToken,
} from '../services/antiCsrfService';

// -- local imports
import {
  SetInclusionOptionType,
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
  loginTempUser,
  setRefreshTokenCookie,
  setAccessTokenCookie,
} from '../services/authService';

import {
  type AuthorizedRequest,
  type AuthorizedResponse,
} from "../models/Auth";

import {
  type PatchPermanentUserRequest,
  type CreatePermanentUserRequest,
  type DeletePermanentUserRequest,
  type IPermanentUserSelfView,
  User,
  isIPermanentUser,
  ConvertTempUserRequest,
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

interface PostUserRouteOkRes {
  token: string;
  user: IPermanentUserSelfView;
}

export const handleCreateUser = async (
  req: Request<{}, {}, CreatePermanentUserRequest>,
  res: Response
) => {
  try {
    const { email, username, password } = req.body;

    // --- Validate input ---
    if (!email || !username || !password) {
      const resp : PostUserRouteBadRequestErrRes = ({
        message: "Email, username, and password are required.",
      });
      return res.status(400).json(resp);
    }

    // --- Check for existing user ---
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const resp : PostUserRouteBadRequestErrRes = ({
        message: "Email already in use.",
      });
      return res.status(400).json(resp);
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      const resp : PostUserRouteBadRequestErrRes = ({
        message: "Username already in use.",
      });
      return res.status(400).json(resp);
    }

    // --- Hash password ---
    const hashed = await bcrypt.hash(password, 10);
    
    const user = new User({
      kind: 'permanent',
      username,
      email,
      passwordHashed: hashed,
    });

    await user.save();

    // --- Automatically log in user via service ---
    const loginResult = await loginPermanentUser("username", username, password);

    switch (loginResult.kind) {
      case 'other_err':
      // -- If user creation logic has been implemented correctly, these cases should never happen
      case 'no_user':
      case 'no_perm_user':
      case 'bad_pass':
        throw new Error(`Unexpected result type: ${JSON.stringify(loginResult)}`);
      case 'ok':
      {
        const resp : PostUserRouteOkRes = ({
          user: loginResult.user.toSelfView(),
          token: loginResult.accessToken,
        });

        return res.status(201).json(resp);
      }
      default:
        throw new Error(`Unexpected result type: ${JSON.stringify(loginResult)}`);
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
};

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
  req: AuthorizedRequest<{}, {}, ConvertTempUserRequest>,
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
  req: AuthorizedRequest<{}, any, PatchPermanentUserRequest>,
  res: AuthorizedResponse,
) => {
  const {
    authUser,
  } = res.locals;
  const patchData: Partial<PatchPermanentUserRequest> = ({
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
  req: AuthorizedRequest<{}, any, DeletePermanentUserRequest>,
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
