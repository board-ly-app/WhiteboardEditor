// -- std imports
import {
  Types,
} from "mongoose";

// -- third-party imports
import bcrypt from "bcrypt";

// -- local imports
import type {
  Result,
  SetInclusionOptionType,
} from '../utils';

import {
  User,
  PatchPermanentUserData,
  type IUserType,
  IPermanentUser,
} from "../models/User";

import {
  Whiteboard,
  type IWhiteboardFull,
  type IWhiteboardPermissionEnum,
} from '../models/Whiteboard';

export type GetUserByIdRes =
  | { status: 'bad_request'; message: string; }
  | { status: 'not_found'; }
  | { status: 'ok'; user: IUserType; }
;

export const getUserById = async (userId: Types.ObjectId): Promise<GetUserByIdRes> => {
  if (! Types.ObjectId.isValid(userId)) {
    return ({
      status: 'bad_request',
      message: `Invalid object id: ${userId}`,
    });
  }

  const user = await User.findOne({ _id: userId }) as IUserType;

  if (! user) {
    return ({
      status: 'not_found',
    });
  } else {
    return ({
      status: 'ok',
      user,
    });
  }
};// end getUser

// === isUserOwnerCollaborator =================================================
//
// Determines whether a certain user owns a whiteboard which is shared with
// another specified user. Important for determining whether the owning user can
// see certain protected fields in the other user's account (namely, their email
// address).
//
// =============================================================================
export const isUserOwnerCollaborator = (
  ownerId: Types.ObjectId,
  collaboratorId: Types.ObjectId
): boolean => {
  // -- Query for at least one whiteboard for which both users have some
  // permission
  const res = Whiteboard.findOne({
    "user_permissions": {
      '$all': [
        {
          '$elemMatch': {
            'user': ownerId,
            'permission': 'own',
          }
        },
        {
          '$elemMatch': {
            'user': collaboratorId,
          }
        },
      ]
    }
  });

  return !!res;
};// -- end areUsersCollaborators

export interface PatchPermanentUserOkResult {
  type: 'ok';
  data: IPermanentUser;
}

export interface PatchPermanentUserErrorResult {
  type: 'error';
  message: string;
}

export type PatchPermanentUserResult = PatchPermanentUserOkResult | PatchPermanentUserErrorResult;

export const patchUser = async (
  user: IPermanentUser,
  patchData: PatchPermanentUserData
): Promise<PatchPermanentUserResult> => {
  try {
    const patchDataLocal = { ...patchData };
    const passwordHashed = patchDataLocal.password ? 
      await bcrypt.hash(patchDataLocal.password, 10)
    : user.passwordHashed;

    if (patchDataLocal.password) {
      delete patchDataLocal.password;
    }

    user.set({
      ...patchDataLocal,
      passwordHashed
    });

    const userModified = await user.save();

    return ({
      type: 'ok',
      data: userModified,
    });
  } catch (err: any) {
    return ({
      type: 'error',
      message: `${err}`
    });
  }
};// -- end patchUser

export const deleteUser = async (
  userId: Types.ObjectId
): Promise<Result<IUserType, string>> => {
  try {
    const deletedUser = await User.findOne({ _id: userId });

    if (! deletedUser) {
      return ({
        result: 'err',
        err: 'No such user found'
      });
    } else {
      await deletedUser.deleteOne();

      return ({
        result: 'ok',
        data: deletedUser,
      });
    }
  } catch (err: any) {
    return ({
      result: 'err',
      err: `${err}`
    });
  };
};

export type GetSharedWhiteboardsByUserRes =
  | { status: 'server_error'; }
  | { status: 'user_not_found'; }
  | { status: 'bad_request'; message: string; }
  | { status: 'ok'; whiteboards: IWhiteboardFull[]; }
;

export const getSharedWhiteboardsByUser = async (
  userId: Types.ObjectId,
  includePermissionOpts: SetInclusionOptionType<IWhiteboardPermissionEnum>,
): Promise<GetSharedWhiteboardsByUserRes> => {
  try {
    if (! Types.ObjectId.isValid(userId)) {
      return ({
        status: 'bad_request',
        message: 'Invalid user id',
      });
    }

    const user = await User.findOne({
      '_id': userId,
    });

    if (! user) {
      return {
        status: 'user_not_found',
      };
    }

    const permissionsFilter : object = (() => {
      switch (includePermissionOpts.type) {
        case 'all':
          return ({ '$nin': [] });
        case 'include':
          return ({ '$in': includePermissionOpts.included });
        case 'exclude':
          return ({ '$nin': includePermissionOpts.excluded });
        default:
          throw new Error(`Unhandled case: ${includePermissionOpts}`);
      }
    })();

    const userQuery = (user.kind === 'permanent') ?
      {
        '$elemMatch': {
          '$or': [
            {
              type: 'user',
              user: userId,
              permission: permissionsFilter,
            },
            {
              email: user.email,
              permission: permissionsFilter,
            },
          ],
        },
      }
      : {
        '$elemMatch': {
          type: 'user',
          user: userId,
          permission: permissionsFilter
        }
      };

    const query = ({
      user_permissions: userQuery,
    });

    const whiteboards = await Whiteboard.findAttribs(query);

    // success
    return ({
      status: 'ok',
      whiteboards,
    });
  } catch (e: any) {
    console.error(
      'An unexpected error occurred while attempting to get whiteboards shared with user',
      userId, ':', e
    );

    return ({
      status: 'server_error'
    });
  }
};// -- end getSharedWhiteboardsByUser
