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
  type IWhiteboardVisibilityEnum,
} from '../models/Whiteboard';

import {
  isIPermanentUser,
  IUserType,
  User,
  type IUser,
} from '../models/User';

import {
  type AuthorizedRequest,
  type OptAuthorizedRequest,
  type AuthorizedResponse,
  type OptAuthorizedResponse,
} from '../models/Auth';

import {
  setSharedUsers,
  getWhiteboardById,
  getWhiteboardsByOwner,
  deleteWhiteboardById,
  removeDanglingUserPermissions,
  createSignedTempConversionPayload,
  verifySignedTempConversionPayload,
} from '../services/whiteboardService';

export interface CreateWhiteboardRequest {
  name: string;
  collaboratorPermissions?: IWhiteboardUserPermissionByEmail[];
  width: number;
  height: number;
  visibility: IWhiteboardVisibilityEnum;
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

if (! ACCESS_TOKEN_SECRET) {
  throw new Error('Missing required env var ACCESS_TOKEN_SECRET');
}

export const handleGetWhiteboardById = async (
  req: OptAuthorizedRequest<{ whiteboardId: string }, any>,
  res: OptAuthorizedResponse,
) => {
  const authUser = res.locals?.authUser;
  const userId = authUser?._id;
  const {
    whiteboardId,
  } = req.params;
  
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
        const {
          whiteboard,
        } = resp;
        
        console.log('Received whiteboard:', JSON.stringify(whiteboard, null, 2));
  
        const isValidUserPerm = (perm: IWhiteboardUserPermissionModel<IUser>): perm is IWhiteboardUserPermissionById <IUser> => {
          return (perm.type === 'user') && (!! perm.user);
        };
        const permsByUserId: Record<string, IWhiteboardPermissionEnum> = Object.fromEntries(
            whiteboard.user_permissions.filter(perm => isValidUserPerm(perm)).map(perm => [
            perm.user.id, perm.permission 
          ])
        );

        if (whiteboard.visibility !== 'public') {
          // Private board - require authenticated user with permission
          if (!userId || !(userId.toString() in permsByUserId)) {
            return res.status(403).json({
              message: 'You are not authorized to view this resource'
            });
          }
        }

        if (userId && permsByUserId[userId.toString()] === 'own') {
          // -- Return owner view
          const wbOwnerView = whiteboard.toOwnerView();
          return res.status(200).json(wbOwnerView);
        } else {
          // -- Return attrib view
          const wbAttribView = whiteboard.toAttribView();
          return res.status(200).json(wbAttribView);
        }
    }
    default:
      return res.status(500).json({ message: 'Unexpected error occurred' });
  }
};// -- end handleGetWhiteboardById

export const handleCreateWhiteboard = async (
  req: AuthorizedRequest<{}, any, CreateWhiteboardRequest>,
  res: AuthorizedResponse,
) => {
  try {
    const { authUser } = res.locals;
    const { name, visibility } = req.body;
    const { _id: ownerId } = authUser;
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
    const foundUsers = await User.find({ email: { $in: collaboratorEmails } }) as IUserType[];

    const permanentUsers = foundUsers.filter(isIPermanentUser);

    // Create quick lookup
    const foundEmails = new Set(permanentUsers
      .map(u => u.email));

    // Permissions for users that exist in DB
    const collarboratorPermissionsFromUsers: IWhiteboardUserPermissionModel <Types.ObjectId>[] =
      permanentUsers.map(user => {
        if (!user.email) {
          throw new Error("Invariant violation: user returned from email query has no email.");
        }

        return {
          type: 'user',
          user: user._id,
          email: user.email,
          permission: collaboratorPermissionsByEmail[user.email].permission,
        }
      });

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
      kind: 'permanent_whiteboard',
      root_canvas: rootCanvas._id,
      thumbnail_url: null,
      user_permissions: [ownerPermission, ...collaboratorPermissionsFinal],
      visibility: visibility,
    });

    console.log('Attempting to create new whiteboard:', whiteboard);

    const whiteboardOut = await whiteboard.save()
      .then(wb => wb.populateFull());
    
    res.status(201).json(whiteboardOut.toOwnerView());
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Server Error:', err);
    } else {
      console.error('Server Error');
    }

    res.status(500).json({ message: "Unexpected server error" });
  }
};// -- end handleCreateWhiteboard

export const handleCreateTempWhiteboard = async (
  req: AuthorizedRequest<{}, any, CreateWhiteboardRequest>,
  res: AuthorizedResponse,
) => {
  try {
    const { authUser } = res.locals;
    const { name } = req.body;
    const { _id: ownerId } = authUser;
    
    // Give owner 'own' permission for user_permissions
    const ownerPermission: IWhiteboardUserPermissionModel<Types.ObjectId> = {
      type: 'user',
      user: ownerId,
      permission: 'own',
    };

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
      kind: 'temp_whiteboard',
      root_canvas: rootCanvas._id,
      thumbnail_url: null,
      user_permissions: [ownerPermission],
      visibility: 'public',
      createdAt: new Date(Date.now())
    });

    console.log('Attempting to create new temp whiteboard:', whiteboard);

    const whiteboardOut = await whiteboard.save()
      .then(wb => wb.populateFull());
    
    res.status(201).json(whiteboardOut.toOwnerView());
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Server Error:', err);
    } else {
      console.log('Server Error');
    }

    res.status(500).json({ message: "Unexpected server error" });
  }
};// -- end handleCreateTempWhiteboard

export const handleChangeWhiteboardName = async (
  req: AuthorizedRequest<{ whiteboardId: string }, any, { newName: string }>,
  res: AuthorizedResponse,
) => {
  const { whiteboardId } = req.params;
  const { authUser } = res.locals;
  const { newName } = req.body;
  const userId = authUser._id;
  
  try {
    const whiteboard = await Whiteboard.findById(whiteboardId);

    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    const hasPermission = whiteboard.user_permissions.some(perm =>
      perm.type === 'user' &&
      perm.user.toString() === userId.toString() &&
      (perm.permission === 'own' || perm.permission === 'edit')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "You do not have permission to change the name of this whiteboard" });
    } 
    
    await Whiteboard.collection.updateOne(
      { _id: new Types.ObjectId(whiteboardId) },
      {
        $set: {
          name: newName,
          time_last_modified: new Date(),
        }
      }
    );

    return res.status(200).json({ message: "Whiteboard name updated successfully" });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Server error:', err);
    } else {
      console.error('Server error');
    }

    return res.status(500).json({ message: "Server error" });
  }
}

// -- Get user's own whiteboards
export const handleGetOwnWhiteboards = async (
  _req: AuthorizedRequest<{}, any>,
  res: AuthorizedResponse,
) => {
  const {
    authUser,
  } = res.locals;
  const {
    _id: ownerId,
  } = authUser;
  // -- filter out dangling user permissions (user permissions for users who no
  // longer exist)
  const ownWhiteboards = (await getWhiteboardsByOwner(ownerId))
    .map(whiteboard => {
      const permissionsFiltered = removeDanglingUserPermissions(whiteboard.user_permissions);

      whiteboard.user_permissions = permissionsFiltered;
      return whiteboard.toOwnerView();
  });

  res.status(200).json(ownWhiteboards);
};// -- end handleGetOwnWhiteboards

export interface WhiteboardPermissionRequest {
  email: string;
  permission: IWhiteboardPermissionEnum;
}

export interface ShareWhiteboardRequestBody {
  userPermissions: IWhiteboardUserPermission<Types.ObjectId>[];
}

export const handleShareWhiteboard = async (
  req: AuthorizedRequest<{ id: WhiteboardIdType }, any, ShareWhiteboardRequestBody>,
  res: AuthorizedResponse,
) => {
  try {
    const { id: whiteboardId } = req.params;
    const { authUser } = res.locals;
    const { userPermissions } = req.body;

    const result = await setSharedUsers(
      whiteboardId,
      authUser._id,
      userPermissions
    );

    switch (result.status) {
      case "success":
        const wbAttribView = result.whiteboard.toOwnerView();

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
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error sharing whiteboard:', err);
    } else {
      console.error('Error sharing whiteboard');
    }

    return res.status(500).json({ error: "Server error" });
  }
};// -- end handleShareWhiteboard

// -- Put the whiteboard's thumbnail
export const handlePutThumbnail = async (
  req: AuthorizedRequest<{ whiteboardId: string }, any, { thumbnailUrl: string }>,
  res: AuthorizedResponse,
) => {
  try {
    const { whiteboardId } = req.params;
    const { authUser } = res.locals;
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

    const hasPermission = whiteboard.user_permissions.some(perm =>
      perm.type === 'user' &&
      perm.user &&
      perm.user._id.toString() === authUser._id.toString() &&
      (perm.permission === 'own' || perm.permission === 'edit')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "You do not have permission to update the thumbnail of this whiteboard." });
    }

    whiteboard.thumbnail_url = thumbnailUrl;

    const wbAttribView = (await whiteboard.save()).toAttribView();

    return res.status(200).json({
      ...wbAttribView,
      user_permissions: removeDanglingUserPermissions(wbAttribView.user_permissions)
    });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error updating thumbnail:', err);
    } else {
      console.error('Error updating thumbnail');
    }

    return res.status(500).json({ message: "Unexpected server error" });
  }
};// -- end handlePutThumbnail

export const handleDeleteWhiteboard = async (
  req: AuthorizedRequest<{ whiteboardId: string }, any>,
  res: AuthorizedResponse,
) => {
  try {
    const {
      whiteboardId,
    } = req.params;
    const {
      authUser,
  } = res.locals;

    const resp = await deleteWhiteboardById(
      new Types.ObjectId(whiteboardId),
      authUser._id
    );

    switch (resp.status) {
      case 'no_whiteboard':
      {
        return res.status(400).json({
          message: `No whiteboard with id ${whiteboardId}`,
        });
      }
      case 'unauthorized':
      {
          return res.status(403).json({
            message: `You are not authorized to delete whiteboard ${whiteboardId}`,
          });
      }
      case 'ok':
      {
        return res.status(200).json({
          message: `Whiteboard ${whiteboardId} deleted successfully`,
        });
      }
      default:
        throw new Error(`Unrecognized response type: ${resp}`);
    }// -- end switch resp.status
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error in handleDeleteWhiteboard:', err);
    } else {
      console.error('Unexpected error in handleDeleteWhiteboard');
    }

    return res.status(500).json({ message: 'Unexpected server error' });
  }
};// -- end handleDeleteWhiteboard

interface AuthTempConversionReqBody {
  permanentUserEmail: string;
}

const isAuthTempConversionReqBody = (reqBody: unknown): reqBody is AuthTempConversionReqBody => {
  if (! reqBody) return false;
  if (typeof reqBody !== 'object') return false;
  if (! ('permanentUserEmail' in reqBody)) return false;
  if (typeof reqBody.permanentUserEmail !== 'string') return false;

  return true;
};// -- end isAuthTempConversionReqBody

export const handleAuthorizeTempConversion = async (
  req: AuthorizedRequest<{ whiteboardId: string }, any>,
  res: AuthorizedResponse,
) => {
  try {
    if (! isAuthTempConversionReqBody(req.body)) {
      return res.status(400).json({ message: 'Bad request body' });
    }

    const tempUserId = res.locals.authUser._id;
    const whiteboardId = req.params.whiteboardId;
    const whiteboard = await Whiteboard.findById(whiteboardId);

    if (! whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    if (whiteboard.kind !== 'temp_whiteboard') {
      return res.status(400).json({ message: "Whiteboard is not a temporary whiteboard" });
    }

    // Check if user has 'own' permission of whiteboard
    const isOwner = whiteboard.user_permissions.some(perm =>
      perm.type === 'user' &&
      perm.user.toString() === tempUserId.toString() &&
      perm.permission === 'own'
    )

    if (! isOwner) {
      return res.status(403).json({ message: `Not the owner of this whiteboard` });
    }

    const signedConversionRequest = createSignedTempConversionPayload({
      tempUserId: tempUserId.toHexString(),
      permanentUserEmail: req.body.permanentUserEmail,
      whiteboardId,
    });

    return res.status(201).json({
      signedConversionRequest,
    })
  } catch (e: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('handleAuthorizeTempConversion failed:', e);
    } else {
      console.error('handleAuthorizeTempConversion failed');
    }

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
};// -- end handleAuthorizeTempConversion

interface ConvertTempToPermReqBody {
  signedConversionRequest: string;
}

const isConvertTempToPermReqBody = (body: unknown): body is ConvertTempToPermReqBody => {
  if (! body) return false;
  if (typeof body !== 'object') return false;
  if (! ('signedConversionRequest' in body)) return false;
  if (typeof body.signedConversionRequest !== 'string') return false;

  return true;
};// -- end isConvertTempToPermReqBody

// -- Authenticated user should be permanent user who is assuming ownership
export const handleConvertTempToPerm = async (
  req: AuthorizedRequest<{ whiteboardId: string }, any>,
  res: AuthorizedResponse,
) => {
  try {
    if (! isConvertTempToPermReqBody(req.body)) {
      return res.status(400).json({ message: 'Bad request body' });
    }

    const conversionRequest = verifySignedTempConversionPayload(req.body.signedConversionRequest);
    if (! conversionRequest) return res.status(400).json({ message: 'Invalid conversion request' });

    const permanentUser = res.locals.authUser;
    if (permanentUser.kind !== 'permanent') {
      return res.status(403).json({ message: 'Can only transfer ownership to permanent user' });
    } else if (conversionRequest.permanentUserEmail !== permanentUser.email) {
      return res.status(403).json({ message: 'You are not the specified permanent user' });
    }

    const { whiteboardId } = req.params;
    const tempUserId = conversionRequest.tempUserId;
    const permanentUserId = permanentUser._id;
    const whiteboard = await Whiteboard.findById(whiteboardId);

    if (! whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }

    if (whiteboard.kind !== 'temp_whiteboard') {
      return res.status(400).json({ message: "Whiteboard is not a temporary whiteboard" });
    }

    // Check if user has 'own' permission of whiteboard
    const isOwner = whiteboard.user_permissions.some(perm =>
      perm.type === 'user' &&
      perm.user.toString() === tempUserId.toString() &&
      perm.permission === 'own'
    )

    if (! isOwner) {
      return res.status(403).json({ message: `Not the owner of this whiteboard` });
    }

    const permUserObjectId = new Types.ObjectId(permanentUserId);

    const updatedPermissions = whiteboard.user_permissions.map(perm => {
      if (perm.type === 'user' && perm.user.toString() === tempUserId.toString()) {
        return {
          permission: 'own',
          type: 'user',
          user: permUserObjectId,
          _id: new Types.ObjectId()
        }
      } else {
        if (perm.type === 'user') {
          perm.user = new Types.ObjectId(perm.user.toString());
        }

        return perm;
      }
    });

    await Whiteboard.collection.updateOne(
      { _id: new Types.ObjectId(whiteboardId) },
      {
        $set: {
          name: 'Trial Whiteboard',
          kind: 'permanent_whiteboard',
          time_created: new Date(),
          time_last_modified: new Date(),
          user_permissions: updatedPermissions,
        },
        $unset: {
          createdAt: ""
        }
      }
    );

    return res.status(201).json({ message: "Whiteboard converted to permanent successfully" });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Server error:', err);
    } else {
      console.error('Server error');
    }

    return res.status(500).json({ message: "Server error", err });
  }
};// -- end handleConvertTempToPerm
