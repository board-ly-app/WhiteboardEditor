import {
  Types,
} from "mongoose";

// --- local imports
import {
  Whiteboard,
  type IWhiteboardFull,
  type IWhiteboardAttribView,
  type WhiteboardIdType,
  type IWhiteboardUserPermission,
  type IWhiteboardUserPermissionModel,
  type IWhiteboardUserPermissionById,
  type IWhiteboardUserPermissionByEmail,
} from '../models/Whiteboard';

import {
  User,
  type IUser,
  type UserIdType,
} from '../models/User';

export type GetWhiteboardRes = 
  | { status: 'ok'; whiteboard: IWhiteboardFull; }
  | { status: 'invalid_id'; }
  | { status: 'not_found'; }
  | { status: 'server_error'; message: string; }
;

// === removeDanglingUserPermissions ===========================================
//
// Filters out user permissions for users who no longer exist.
//
// =============================================================================
export const removeDanglingUserPermissions = (
  populatedUserPermissions: IWhiteboardUserPermission<Partial<IUser> | null>[]
): IWhiteboardUserPermission<IUser>[] => {
  const filterPermission = (perm: IWhiteboardUserPermission<Partial<IUser> | null>): perm is IWhiteboardUserPermission<IUser> => (
    perm.type !== 'user' || ((!! perm.user) && (!! perm.user.id))
  );
  const permissionsFiltered = populatedUserPermissions.filter(filterPermission);

  return permissionsFiltered;
};// -- end removeDanglingUserPermissions

export const getWhiteboardById = async (whiteboardId: string): Promise<GetWhiteboardRes> => {
  try {
    if (! Types.ObjectId.isValid(whiteboardId)) {
      return ({ status: 'invalid_id' });
    }

    let whiteboard = await Whiteboard.findById(whiteboardId)
      .then(wb => wb?.populateAttribs() || null);

    if (! whiteboard) {
      return ({ status: 'not_found' });
    } else {
      // track whether we change any email-based permissions to user-based
      // permissions
      let haveSharedUsersChanged = false;
      const sharedUsers: IWhiteboardUserPermissionModel<Types.ObjectId>[] = await Promise.all(whiteboard.user_permissions
          .filter(perm => (perm.type !== 'user') || ((!! perm.user) && (!! perm.user._id)))
          .map(async perm => {
        switch (perm.type) {
          case 'user':
            return ({
              type: 'user',
              user: perm.user._id,
              permission: perm.permission,
            }) ;
          case 'email':
            // check if this email now belongs to a registered user
            const user = await User.findOne({ email: perm.email });
            console.log('!! Found email-identified user:', user);

            if (user) {
              haveSharedUsersChanged = true;

              return ({
                type: 'user',
                user: user._id,
                permission: perm.permission,
              });
            } else {
              return perm; // keep as email if still unregistered
            }
          default:
            throw new Error(`Unrecognized permission type: ${perm}`);
        }
      }));

      if (haveSharedUsersChanged) {
        // reset the whiteboard's user_permissions field in-database, then refetch the
        // whiteboard
        whiteboard.set('user_permissions', sharedUsers);
        whiteboard = await whiteboard.save()
          .then(wb => wb.populateAttribs());

        if (! whiteboard) {
          throw new Error(`Whiteboard ${whiteboardId} not properly (re-)fetched`);
        }
      }

      console.log("Returning whiteboard:", JSON.stringify(whiteboard, null, 2));

      return ({
        status: 'ok',
        whiteboard,
      });
    }
  } catch (err: any) {
    console.log('Error fetching whiteboard', whiteboardId, ':', err);
    return ({
      status: 'server_error',
      message: 'An unexpected error occurred',
    });
  }
};// -- end getWhiteboardById

export const getWhiteboardsByOwner = async (ownerId: Types.ObjectId): Promise<IWhiteboardAttribView[]> => {
  const query = {
    user_permissions: {
      '$elemMatch': {
        user: ownerId,
        permission: 'own',
      },
    },
  };

  return await Whiteboard.findAttribs(query) as IWhiteboardAttribView[];
};// -- end getWhiteboardsByOwner

export type GetSharedUsersByWhiteboardRes =
  | { status: 'ok'; sharedUsers: IWhiteboardUserPermission <IUser>[]; }
  | { status: 'whiteboard_not_found'; }
;

export const getSharedUsersByWhiteboard = async (whiteboardId: Types.ObjectId): Promise<GetSharedUsersByWhiteboardRes> => {
  const sharedUsers: IWhiteboardUserPermission <IUser>[] | null = await Whiteboard.findSharedUsersByWhiteboardId(whiteboardId);

  if (! Array.isArray(sharedUsers)) {
    return ({ status: 'whiteboard_not_found', });
  } else {
    return ({
      status: 'ok',
      sharedUsers
    });
  }
};

export type ShareWhiteboardResType =
  | { status: "success"; whiteboard: IWhiteboardFull; }
  | { status: "no_whiteboard" }
  | { status: "invalid_users"; invalid_users: UserIdType[] }
  | { status: "invalid_permissions"; invalid_permissions: IWhiteboardUserPermission <Types.ObjectId>[] }
  | { status: "forbidden" }
  | { status: "need_one_owner" }
  | { status: "exception"; message: string };

export const setSharedUsers = async (
  whiteboardId: WhiteboardIdType,
  ownerId: UserIdType,
  userPermissions: IWhiteboardUserPermission <Types.ObjectId>[]
): Promise<ShareWhiteboardResType> => {
  try {
    // first, ensure given id can actually be cast to an ObjectId
    if (! Types.ObjectId.isValid(whiteboardId)) {
      return { status: "no_whiteboard" };
    }

    const whiteboards = await Whiteboard.findAttribs({ _id: whiteboardId });

    if ((! whiteboards) || (whiteboards.length < 1)) {
      return { status: "no_whiteboard" };
    }

    const whiteboard = whiteboards[0];

    // Verify that the "owner" (the user indicated by ownerId) is either the
    // owner or has "own" permission over the whiteboard.
    const ownerIdSet = Object.fromEntries([
      ...(whiteboard.user_permissions as IWhiteboardUserPermissionModel<IUser>[])
        .filter((perm: IWhiteboardUserPermissionModel<IUser>): perm is IWhiteboardUserPermissionById<IUser> => (
          perm.type === 'user' && perm.permission === 'own'
        ))
        .map((perm: IWhiteboardUserPermissionById<IUser>) => [perm.user._id.toString(), true])
    ]);

    if (! (ownerId.toString() in ownerIdSet)) {
      return { status: "forbidden" };
    }

    const permissionsById = userPermissions.filter(perm => perm.type === 'user');

    if (permissionsById.length > 0) {
      // ensure all permissions by id are valid
      const malformedUserIds = permissionsById
        .filter(perm => (! Types.ObjectId.isValid(perm.user)))
        .map(perm => perm.user);

      if (malformedUserIds.length > 0) {
        return {
          status: 'invalid_users',
          invalid_users: malformedUserIds
        };
      }
      
      const userIds = permissionsById.map(perm => perm.user);

      // validate users exist
      const foundUsers = await User.find({ _id: { $in: userIds } }).select("_id");
      const foundIds = foundUsers.map((u) => u.id.toString());
      const invalidUsers = userIds.filter(u => (! foundIds.includes(u.toString())));

      if (invalidUsers.length > 0) {
        return { status: "invalid_users", invalid_users: invalidUsers };
      }
    }

    // try to convert emails to user ids, if users accounts exist
    const permissionsByEmail = userPermissions.filter(perm => perm.type === 'email');
    const permissionEmails: string[] = permissionsByEmail.map(perm => perm.email);
    const emailsToPermissions = Object.fromEntries(permissionsByEmail.map(perm => [
      perm.email, perm
    ]));
    const foundUsersByEmail = await User.find({ email: { $in: permissionEmails } });
    const foundEmailSet: Record<string, boolean> = Object.fromEntries(foundUsersByEmail.map(user => [user.email, true]));
    const permissionsByIdFromEmail: IWhiteboardUserPermissionById<Types.ObjectId>[] = foundUsersByEmail.map(user => ({
      type: 'user',
      user: user._id,
      permission: emailsToPermissions[user.email].permission,
    }));
    const finalEmailPermissions : IWhiteboardUserPermissionByEmail[] = permissionsByEmail.filter(perm => !(perm.email in foundEmailSet));
    const finalPermissions = [
      ...permissionsById,
      ...permissionsByIdFromEmail,
      ...finalEmailPermissions
    ];

    // -- check that we have at least one owner whose account exists (not just
    // an email address)
    if (! finalPermissions.find(perm => perm.permission === 'own' && perm.type === 'user')) {
      return ({
        status: "need_one_owner",
      });
    } else {
      // fully replace old permissions
      whiteboard.set('user_permissions', finalPermissions);

      await whiteboard.save()
        .then(wb => wb.populateAttribs());

      return ({
        status: "success",
        whiteboard,
      });
    }
  } catch (err: any) {
    console.error(`Error sharing whiteboard ${whiteboardId}:`, err);
    return {
      status: 'exception',
      message: `${err}`
    };
  }
};// -- end setSharedUsers
