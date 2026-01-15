import { Request, Response } from "express";
import {
  Types,
} from "mongoose";

// --- local imports
import {
  Whiteboard,
  Canvas,
  type WhiteboardIdType,
  type IWhiteboardPermissionEnum,
  type IWhiteboardUserPermission,
  type IWhiteboardUserPermissionModel,
  type IWhiteboardUserPermissionById,
  type IWhiteboardUserPermissionByEmail,
} from '../models/Whiteboard';

import {
  User,
  type IUser,
} from '../models/User';

import type {
  AuthorizedRequestBody
} from '../models/Auth';

import {
  setSharedUsers,
  getWhiteboardById,
  getWhiteboardsByOwner,
  removeDanglingUserPermissions,
} from '../services/whiteboardService';

export interface CreateWhiteboardRequest extends AuthorizedRequestBody {
  name: string;
  collaboratorPermissions?: IWhiteboardUserPermissionByEmail[];
  width: number;
  height: number;
}

export const handleGetWhiteboardById = async (
  req: Request<{ whiteboardId: string }, any, AuthorizedRequestBody>,
  res: Response
) => {
    const { authUser } = req.body;
    const { id: userId } = authUser;
    const { whiteboardId } = req.params;

    // fetch whiteboard by id
    const resp = await getWhiteboardById(whiteboardId);

    switch (resp.status) {
      case 'server_error':
        return res.status(500).json({ message: 'An unexpected error occurred' });
      case 'invalid_id':
        return res.status(400).json({ message: 'Invalid whiteboard id' });
      case 'not_found':
        return res.status(404).json({ message: 'Whiteboard not found' });
      case 'ok':
      {
          const { whiteboard } = resp;
          
          console.log('Received whiteboard:', JSON.stringify(whiteboard, null, 2));

          const isValidUserPerm = (perm: IWhiteboardUserPermissionModel<IUser>): perm is IWhiteboardUserPermissionById <IUser> => {
            return (perm.type === 'user') && (!! perm.user);
          };
          const validUserIdSet: Record<string, boolean> = Object.fromEntries(
              whiteboard.user_permissions.filter(perm => isValidUserPerm(perm)).map(perm => [
              perm.user.id, true 
            ])
          );

          if (! (userId.toString() in validUserIdSet)) {
            return res.status(403).json({
              message: 'You are not authorized to view this resource'
            });
          } else {
            const wbAttribView = whiteboard.toAttribView();

            return res.status(200).json(wbAttribView);
          }
      }
      default:
        return res.status(500).json({ message: 'Unexpected error occurred' });
    }
};// -- end handleGetWhiteboardById

export const handleCreateWhiteboard = async (
  req: Request<{}, any, CreateWhiteboardRequest, {}>,
  res: Response
) => {
  try {
    const { authUser, name } = req.body;
    const { id: ownerId } = authUser;
    console.log("handleCreateWhiteboard req.body: ", req.body);
    
    // Give owner 'own' permission for user_permissions
    const ownerPermission: IWhiteboardUserPermissionModel<Types.ObjectId> = {
      type: 'user',
      user: ownerId,
      permission: 'own',
    };

    // Get collaborator permissions if provided
    const collaboratorPermissions: IWhiteboardUserPermissionByEmail[] = req.body.collaboratorPermissions || [];
    const collaboratorPermissionsByEmail : Record<string, IWhiteboardUserPermissionByEmail> = Object.fromEntries(
      collaboratorPermissions.map(perm => [perm.email, perm])
    );
    const collaboratorEmails : string[] = collaboratorPermissions.map(perm => perm.email);

    // Fetch users whose emails match
    const foundUsers = await User.find({ email: { $in: collaboratorEmails } });

    // Create quick lookup
    const foundEmails = new Set(foundUsers.map(u => u.email));

    // Permissions for users that exist in DB
    const collarboratorPermissionsFromUsers: IWhiteboardUserPermissionModel <Types.ObjectId>[] =
      foundUsers.map(user => ({
        type: 'user',
        user: user._id,
        permission: collaboratorPermissionsByEmail[user.email].permission,
      }) as IWhiteboardUserPermissionById <Types.ObjectId>);

    // For emails that don't match an account, keep them as email permissions
    const collarboratorPermissionsFromEmail: IWhiteboardUserPermissionByEmail[] = 
      collaboratorEmails
        .filter(email => !foundEmails.has(email))
        .map(email => ({
          type: 'email',
          email,
          permission: collaboratorPermissionsByEmail[email].permission,
        }));

    const collaboratorPermissionsFinal = [
      ...collarboratorPermissionsFromUsers,
      ...collarboratorPermissionsFromEmail
    ];

    // initialize every new whiteboard with a single empty canvas
    const rootCanvasModel = new Canvas({
      name: "Main Canvas",
      width: req.body.width,
      height: req.body.height,
      allowed_users: [],
    });

    const rootCanvas = await rootCanvasModel.save();

    const whiteboard = new Whiteboard({
      name,
      root_canvas: rootCanvas._id,
      thumbnail_url: null,
      user_permissions: [ownerPermission, ...collaboratorPermissionsFinal]
    });

    console.log('Attempting to create new whiteboard:', whiteboard);

    const whiteboardOut = await whiteboard.save()
      .then(wb => wb.populateFull());
    
    res.status(201).json(whiteboardOut.toPublicView());
  } catch (err: any) {
    console.log('Server Error:', err);
    res.status(500).json({ message: "Unexpected server error" });
  }
};// -- end handleCreateWhiteboard

// -- Get user's own whiteboards
export const handleGetOwnWhiteboards = async (
  req: Request<{}, any, AuthorizedRequestBody>,
  res: Response
) => {
  const {
    authUser,
  } = req.body;
  const {
    id: ownerId,
  } = authUser;
  // -- filter out dangling user permissions (user permissions for users who no
  // longer exist)
  const ownWhiteboards = (await getWhiteboardsByOwner(ownerId))
    .map(whiteboard => {
      const permissionsFiltered = removeDanglingUserPermissions(whiteboard.user_permissions);

      whiteboard.user_permissions = permissionsFiltered;
      return whiteboard;
  });

  res.status(200).json(ownWhiteboards);
};// -- end handleGetOwnWhiteboards

export interface WhiteboardPermissionRequest {
  email: string;
  permission: IWhiteboardPermissionEnum;
}

export interface ShareWhiteboardRequestBody extends AuthorizedRequestBody {
  userPermissions: IWhiteboardUserPermission<Types.ObjectId>[];
}

export const handleShareWhiteboard = async (
  req: Request<{ id: WhiteboardIdType }, any, ShareWhiteboardRequestBody>,
  res: Response
) => {
  try {
    const { id: whiteboardId } = req.params;
    const { authUser, userPermissions } = req.body;

    const result = await setSharedUsers(
      whiteboardId,
      authUser.id,
      userPermissions
    );

    switch (result.status) {
      case "success":
        const wbAttribView = result.whiteboard.toAttribView();

        return res.status(200).json({
          ...wbAttribView,
          user_permissions: removeDanglingUserPermissions(wbAttribView.user_permissions)
        });
      case "no_whiteboard":
        return res.status(404).json({ error: "Whiteboard not found" });
      case "invalid_users":
        return res
          .status(400)
          .json({ error: "Invalid users", invalid_users: result.invalid_users });
      case "invalid_permissions":
        return res
          .status(400)
          .json({ error: "Invalid permissions", invalid_permissions: result.invalid_permissions });
      case "need_one_owner":
        return res
          .status(400)
          .json({ error: "Whiteboard needs at least one owner whose account has already been created" });
      case "forbidden":
        return res.status(403).json({ error: "You do not own this whiteboard" });
      default:
        console.error('Unexpected error:', result);
        return res.status(500).json({ error: "Unexpected error" });
    }
  } catch (err: any) {
    console.error("Error sharing whiteboard:", err);
    return res.status(500).json({ error: "Server error" });
  }
};// -- end handleShareWhiteboard

// -- Put the whiteboard's thumbnail
export const handlePutThumbnail = async (
  req: Request<{ whiteboardId: string }, any, AuthorizedRequestBody & { thumbnailUrl: string }>,
  res: Response 
) => {
  try {
    const { whiteboardId } = req.params;
    const { thumbnailUrl } = req.body;

    if (!thumbnailUrl || typeof thumbnailUrl != "string") {
      return res.status(400).json({ message: "thumbnailUrl string is required" })
    }

    const resp = await getWhiteboardById(whiteboardId);

    switch (resp.status) {
      case 'invalid_id':
        return res.status(400).json({ message: 'Invalid whiteboard id' });
      case 'not_found':
        return res.status(400).json({ message: 'Whiteboard not found' });
      case 'server_error':
        return res.status(400).json({ message: 'Unexpected server error' });
    }

    const { whiteboard } = resp;

    whiteboard.thumbnail_url = thumbnailUrl;

    const wbAttribView = (await whiteboard.save()).toAttribView();

    return res.status(200).json({
      ...wbAttribView,
      user_permissions: removeDanglingUserPermissions(wbAttribView.user_permissions)
    });
  } catch (err) {
    console.error("Error updating thumbnail", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};
