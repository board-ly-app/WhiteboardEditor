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

// -- local imports
import {
  SetInclusionOptionType
} from '../utils';

import {
  getUserById,
  patchUser,
  deleteUser,
  getSharedWhiteboardsByUser,
} from "../services/userService";

import {
  permanentUserLoginService,
  tempUserLoginService,
} from '../services/loginService';

import type {
  AuthorizedRequestBody
} from "../models/Auth";

import {
  User,
  type PatchPermanentUserRequest,
  type CreatePermanentUserRequest,
  isIPermanentUser,
} from "../models/User";

import {
  Whiteboard,
  type IWhiteboardPermissionEnum,
} from '../models/Whiteboard';

export const handleCreateUser = async (
  req: Request<{}, {}, CreatePermanentUserRequest>,
  res: Response
) => {
  try {
    const { email, username, password } = req.body;

    // --- Validate input ---
    if (!email || !username || !password) {
      return res.status(400).json({ error: "Email, username, and password are required."});
    }

    // --- Check for existing user ---
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already in use." });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already in use." });
    }

    // --- Hash password ---
    const hashed = await bcrypt.hash(password, 10);

    // --- Create user ---
    const user = new User({
      username,
      email,
      kind: 'permanent',
      passwordHashed: hashed,
    });

    const userFinal = await user.save();

    // --- Automatically log in user via service ---
    try {
      const loginResult = await permanentUserLoginService("username", username, password);
      return res.status(201).json({
        user: userFinal.toPublicView(),
        token: loginResult.token
      });
    } catch (err: any) {
      console.error("Login after signup failed: ", err);   
      return res.status(500).json({ message: 'Unexpected login failure' })   
    }
    
  } catch (err: any) {
    console.error("Create user failed: ", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// === POST /users/temp ======================================================
//
// Create a temporary user account for trial whiteboard use.
//
// =============================================================================
export const handleCreateTempUser = async (
  _req: Request,
  res: Response
) => {
  const resp = await tempUserLoginService();

  switch(resp.status) {
    case 'missing_env':
      return res.status(500).json({ message: resp.envVar });
    case 'unexpected_error':
      return res.status(500).json({ message: resp.message });
    case 'ok':
      res.cookie("refreshToken", resp.payload.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict"
      });

      return res.status(201).json({ 
        ...resp.payload,
        user: resp.payload.user
      });
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
  req: Request<{ userId: Types.ObjectId | 'me'}, any, AuthorizedRequestBody>,
  res: Response
) => {
    const { authUser } = req.body;
    const { id: authUserId } = authUser;
    const { userId } = req.params;
    const targetUserId = (userId === 'me') ? authUserId : userId;

    const resp = await getUserById(targetUserId);
    
    switch (resp.status) {
      case 'bad_request':
        return res.status(400).json({ message: resp.message });
      case 'not_found':
        return res.status(404).json({ message: `User ${targetUserId} not found` });
      case 'ok':
        return res.status(200).json(resp.user.toAttribView());
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
  req: Request<{}, any, PatchPermanentUserRequest>,
  res: Response
) => {
  const {
    authUser,
  } = req.body;
  const patchData: Partial<PatchPermanentUserRequest> = ({
    ...req.body
  });
  const {
    id: userId,
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
          delete patchData.authUser;
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

            return res.status(201).json(patchUserRes.data);
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
  req: Request<{}, any, AuthorizedRequestBody>,
  res: Response
) => {
  const { authUser } = req.body;
  const { id: userId } = authUser;
  const resp = await deleteUser(userId);

  if (resp.result === 'err') {
    res.status(400).json({ message: resp.err });
  } else {
    res.status(200).json(resp.data);
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
  req: Request<{ userId: Types.ObjectId | 'me' }, any, AuthorizedRequestBody>,
  res: Response,
) => {
  const {
    userId,
  } = req.params;
  const { authUser } = req.body;
  const { id: authUserId } = authUser;

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
};
