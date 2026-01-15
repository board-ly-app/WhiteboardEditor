import {
  Schema,
  model,
  Types,
  type Document,
  type Model,
} from "mongoose";

import type {
  DocumentVirtualBase,
  DocumentViewMethods,
  ViewDocument,
} from './Model';

import {
  type IUser,
  type IUserPublicView,
  type IUserAttribView,
} from './User';

export type WhiteboardIdType = Types.ObjectId;

export type ShapeTypeEnum = 
  | 'rect'
  | 'ellipse'
  | 'vector'
;

const SHAPE_TYPE_ENUM = [
  'rect',
  'ellipse',
  'vector',
];

export interface IShapeModel {
  type: ShapeTypeEnum;
  // other shape fields vary by shape
  // no need to specify them here
}

export interface IShapeDocument extends IShapeModel {
  // reference to the parent canvas
  canvas_id: Types.ObjectId;
}

// -- no protected fields
export type IShapePublicView = IShapeDocument;

// -- no vector fields
export type IShapeAttribView = IShapeDocument;

export type IShape =
  & IShapeDocument
  & DocumentViewMethods<IShape, IShapePublicView, IShapeAttribView>
  & Document <Types.ObjectId>
;

export type IShapeVirtual = DocumentVirtualBase;

export type ShapeModelType = Model<IShapeDocument, {}, {}, IShapeVirtual>;

export const shapeSchema = new Schema<IShape, ShapeModelType, {}, {}, IShapeVirtual>(
  // -- fields
  {
    canvas_id: { type: Schema.Types.ObjectId, ref: 'Canvas', required: true },
    type: { type: String, enum: SHAPE_TYPE_ENUM, required: true },
  },
  {
    // -- misc. options
    strict: false,

    // -- serialization options
    toObject: {
      virtuals: false,
    },
    toJSON: {
      virtuals: false,
      transform: (_, ret: Partial<IShape>) => {
        delete ret._id;

        return ret;
      },
    },

    // -- instance methods
    methods: {
      toPublicView() {
        // -- no fields to hide
        return this.toJSON();
      },
      toAttribView() {
        // -- no vector fields
        return this.toJSON();
      }
    },
  }
);

shapeSchema.virtual('id').get(function() {
  return this._id;
});

export const Shape = model<IShape>("Shape", shapeSchema, "shapes");

// === ICanvasParent ===========================================================
//
// Optional parent reference embedded within a Canvas. Needed to enable nested
// canvases.
//
// =============================================================================
export interface ICanvasParent {
  // reference to parent
  canvas: Types.ObjectId;
  // x-coordinate of this canvas' top-left corner within its parent
  origin_x: number;
  // y-coordinate of this canvas' top-left corner within its parent
  origin_y: number;
}// -- end interface ICanvasParent

export const canvasParentSchema = new Schema<ICanvasParent>(
  // -- fields
  {
    canvas: { type: Schema.Types.ObjectId, ref: 'Canvas', required: true },
    origin_x: { type: Number, required: true },
    origin_y: { type: Number, required: true },
  },
  // -- settings
  {
  },
);

export interface ICanvasModel <UserType> {
  name: string;
  width: number;
  height: number;
  time_created: Date;
  time_last_modified: Date;

  // -- vector fields: exclude from attribute view
  allowed_users: UserType[];  // references to User
}

export interface ICanvasDocument <UserType> extends ICanvasModel <UserType> {
  // optional reference to parent canvas
  parent_canvas?: ICanvasParent;
}

// -- Canvas as Mongo document
export type ICanvas <UserType> =
  & ICanvasDocument <UserType>
  & DocumentViewMethods<ICanvas <IUser>, ICanvasPublicView, ICanvasAttribView>
  & Document <Types.ObjectId>
;

export interface ICanvasVirtual <ChildCanvasType, ShapeType> extends DocumentVirtualBase {
  child_canvases: ChildCanvasType[];
  shapes: ShapeType[];
}

export type ICanvasFull = ICanvas<IUser> & ICanvasVirtual<ICanvas <IShape>, IShape>;

export type CanvasModelType = Model<ICanvasDocument <Types.ObjectId>, {}, {}, ICanvasVirtual <Types.ObjectId, Types.ObjectId>>;

type CanvasVectorFields = 
  | "child_canvases"
  | "shapes"
;

const CANVAS_VECTOR_FIELDS = [
  "child_canvases",
  "shapes",
];

// === Data Transfer Objects ===================================================
//
// =============================================================================

export type ICanvasPublicView = ViewDocument <ICanvasDocument <IUserPublicView> & ICanvasVirtual<ICanvasPublicView, IShapePublicView>>;

export type ICanvasAttribView = Omit<ICanvasPublicView, CanvasVectorFields>;

const CANVAS_POP_FIELDS_ATTRIBS = [
  'allowed_users',
];

const CANVAS_POP_FIELDS_FULL = [
  ...CANVAS_POP_FIELDS_ATTRIBS,
  'child_canvases',
  'shapes',
];

export const canvasSchema = new Schema<ICanvas <Types.ObjectId>, CanvasModelType, {}, {}, ICanvasVirtual <Types.ObjectId, Types.ObjectId>>(
  // -- fields
  {
    name: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    time_created: { type: Date, default: Date.now },
    time_last_modified: { type: Date, default: Date.now },

    // -- embedded vector fields
    allowed_users: [{ type: Schema.Types.ObjectId, ref: "User" }]

    // -- virtual vector fields
    // child_canvases: { type: Schema.Types.ObjectId, ref: 'Canvas', required: false },
  },
  {
    toObject: {
      virtuals: false,
    },
    toJSON: {
      virtuals: false,
      transform: (_, ret: Partial<ICanvas <Types.ObjectId>>) => {
        delete ret._id;

        return ret;
      },
    },
    // -- instance methods
    methods: {
      async populateAttribs(): Promise<ICanvas <IUser>> {
        return await this.populate(CANVAS_POP_FIELDS_ATTRIBS);
      },
      async populateFull(): Promise<ICanvas <IUser>> {
        return await this.populate(CANVAS_POP_FIELDS_FULL);
      },
      toPublicView(): ICanvasPublicView {
        const obj = this.toObject({ virtuals: true });

        const {
          allowed_users: _allowed_users,
          shapes: _shapes,
          ...fields
        } = obj;

        return ({
          ...fields,
          allowed_users: (this as unknown as ICanvas <IUser>)
            .allowed_users.map(user => user.toPublicView()),
          child_canvases: (this as unknown as ICanvas <IUser> & ICanvasVirtual<ICanvas <IShape>, IShape>)
            .child_canvases.map(canvas => canvas.toPublicView()),
          shapes: (this as unknown as ICanvas <IUser> & ICanvasVirtual<ICanvas <IShape>, IShape>)
            .shapes.map(shape => shape.toPublicView()),
        });
      },
      toAttribView(): ICanvasAttribView {
        const obj = this.toObject({ virtuals: true });

        const {
          allowed_users,
          shapes,
          ...fields
        } = obj;

        return ({
          ...fields,
          allowed_users: (this as unknown as ICanvas <IUser>)
            .allowed_users.map(user => user.toAttribView()),
        });
      }
    },
    // -- static methods
    statics: {
      // retrieve documents with all virtuals populated
      findFull(options: Record<string, any>) {
        return this.find(options)
          .populate({
            path: 'allowed_users',
          })
          .populate({
            path: 'shapes',
          });
      },
      // retrieve documents excluding vector fields
      findAttribViews(options: Record<string, any>) {
        return this.find(options)
          .select(CANVAS_VECTOR_FIELDS
            .map(field => `-${field}`)
            .join(' ')
          )
          .populate({
            path: 'allowed_users',
          });
      }
    },
  }
);

canvasSchema.virtual('id').get(function() {
  return this._id;
});

canvasSchema.virtual('shapes', {
  ref: 'Shape',
  localField: '_id',
  foreignField: 'canvas_id',
  justOne: false,
});

// Only fetches immediate children, not all descendants
canvasSchema.virtual('child_canvases', {
  ref: 'Canvas',
  localField: '_id',
  foreignField: 'parent_canvas.canvas',
});

// ALWAYS specify collection name explicitly ("canvases"), otherwise it will
// incorrectly be named "canvas".
export const Canvas = model<ICanvas<Types.ObjectId>>("Canvas", canvasSchema, "canvases");

export type IWhiteboardPermissionEnum =
  | 'view'
  | 'edit'
  | 'own'
;

export interface IWhiteboardUserPermissionBase {
  permission: IWhiteboardPermissionEnum;
}

export interface IWhiteboardUserPermissionById <UserType> extends IWhiteboardUserPermissionBase {
  type: 'user';
  user: UserType;
}

export interface IWhiteboardUserPermissionByEmail extends IWhiteboardUserPermissionBase {
  type: 'email';
  email: string;
}

export type IWhiteboardUserPermissionModel <UserType> = 
  | IWhiteboardUserPermissionById <UserType>
  | IWhiteboardUserPermissionByEmail
;

export type IWhiteboardUserPermissionPublicView = IWhiteboardUserPermissionModel<IUserPublicView>;

export type IWhiteboardUserPermissionAttribView = IWhiteboardUserPermissionModel<IUserAttribView>;

export type IWhiteboardUserPermission <UserType> =
  & IWhiteboardUserPermissionModel<UserType>
  & DocumentViewMethods<
    IWhiteboardUserPermission<UserType>,
    IWhiteboardUserPermissionPublicView,
    IWhiteboardUserPermissionAttribView
  >
  & Document<Types.ObjectId>
;

export type WhiteboardUserPermissionModelType <UserType> = Model<IWhiteboardUserPermission<UserType>, {}, {}, {}>;

const whiteboardUserPermissionSchema = new Schema<IWhiteboardUserPermission <Types.ObjectId>, WhiteboardUserPermissionModelType<Types.ObjectId>, {}, {}, {}>(
  {
    permission: { type: String, enum: ['view', 'edit', 'own'], required: true },
  },
  {
    discriminatorKey: 'type',
  }
);

export interface IWhiteboardModel <UserType, CanvasType> {
  name: string;
  time_created: Date;
  root_canvas: CanvasType;
  thumbnail_url: string;

  // -- vector fields: exclude from attribute view
  user_permissions: IWhiteboardUserPermission<UserType>[];
}

export type IWhiteboard <UserType, CanvasType> =
  & IWhiteboardDocument <UserType, CanvasType>
  & DocumentViewMethods<IWhiteboard <IUser, ICanvas<IUser>>, IWhiteboardPublicView, IWhiteboardAttribView>
  & Document <Types.ObjectId>
;

export type IWhiteboardFull = IWhiteboard<IUser, ICanvas<IUser>>;

type WhiteboardVectorFields = 
  | "canvases"
;

const WHITEBOARD_VECTOR_FIELDS = [
  "canvases",
];

const WHITEBOARD_POP_FIELDS_ATTRIBS = [
  'root_canvas',
  {
    path: 'user_permissions',
    populate: [
      'user',
    ],
  },
];

const WHITEBOARD_POP_FIELDS_FULL = [
  ...WHITEBOARD_POP_FIELDS_ATTRIBS,
];

// === Data Transfer Objects ===================================================
//
// =============================================================================

export type IWhiteboardDocument <UserType, CanvasType> = IWhiteboardModel <UserType, CanvasType>;

export type IWhiteboardPublicView = ViewDocument<IWhiteboardDocument <IUser, ICanvas<IUser>>>;

export type IWhiteboardAttribView = Omit<IWhiteboardPublicView, WhiteboardVectorFields>;

export interface IWhiteboardSchema <UserType, CanvasType> extends Model<IWhiteboard<UserType, CanvasType>> {
  findFull: (options: Record<string, any>) => Promise<IWhiteboard <IUser, ICanvas<IUser>>[]>;
  findAttribs: (options: Record<string, any>) => Promise<IWhiteboard<IUser, ICanvas<IUser>>[]>;
  findSharedUsersByWhiteboardId: (whiteboardId: Types.ObjectId) => Promise<IWhiteboardUserPermission<IUser>[] | null>;
}

const whiteboardSchema = new Schema<IWhiteboard<Types.ObjectId, Types.ObjectId>, IWhiteboardSchema<Types.ObjectId, Types.ObjectId>>(
  {
    name: { type: String, required: true },
    time_created: { type: Date, default: Date.now },
    root_canvas: { type: Schema.Types.ObjectId, ref: "Canvas", required: true },
    thumbnail_url: { type: String, required: false, default: null },
    user_permissions: [whiteboardUserPermissionSchema],
  },
  {
    toObject: {
      virtuals: false,
    },
    toJSON: {
      virtuals: true,
      transform: (_, ret: Partial<IWhiteboard<Types.ObjectId, Types.ObjectId>>) => {
        delete ret._id;

        return ret;
      },
    },
    // -- instance methods
    methods: {
      async populateAttribs(): Promise<IWhiteboard <IUser, ICanvas<IUser>>> {
        await this.populate(WHITEBOARD_POP_FIELDS_ATTRIBS);
        return this as unknown as IWhiteboard <IUser, ICanvas<IUser>>;
      },
      async populateFull(): Promise<IWhiteboard <IUser, ICanvas<IUser>>> {
        await this.populate(WHITEBOARD_POP_FIELDS_FULL);
        return this as unknown as IWhiteboard <IUser, ICanvas<IUser>>;
      },
      toPublicView() {
        const obj = this.toObject({ virtuals: true });
        const {
          _id,
          user_permissions: _user_permissions,
          ...fields
        } = obj;

        return ({
          ...fields,
          user_permissions: (this as unknown as IWhiteboard <IUser, ICanvas<IUser>>)
            .user_permissions
            .filter(perm => ((perm.type !== 'user') || ((!! perm.user) && (!! perm.user.id))))
            .map(perm => perm.toPublicView()),
        });
      },
      toAttribView() {
        const obj = this.toObject({ virtuals: true });
        const {
          _id,
          user_permissions: _user_permissions,
          ...fields
        } = obj;

        return ({
          ...fields,
          user_permissions: (this as unknown as IWhiteboard <IUser, ICanvas<IUser>>)
            .user_permissions
            .filter(perm => ((perm.type !== 'user') || ((!! perm.user) && (!! perm.user.id))))
            .map(perm => perm.toAttribView()),
        });
      }
    },
    // -- static methods
    statics: {
      findFull(options: Record<string, any>) {
        return this.find(options)
          .populate(WHITEBOARD_POP_FIELDS_FULL);
      },
      findAttribs(options: Record<string, any>) {
        return this.find(options)
          .select(WHITEBOARD_VECTOR_FIELDS.map(field => `-${field}`).join(' '))
          .populate(WHITEBOARD_POP_FIELDS_ATTRIBS);
      },
      async findSharedUsersByWhiteboardId(whiteboardId: Types.ObjectId): Promise<IWhiteboardUserPermission<IUser>[] | null> {
        const res : Partial<IWhiteboard <IUser, ICanvas<IUser>>> | null = await this.findById(whiteboardId)
          .select("user_permissions")
          .then(wb => wb?.populateAttribs() || null);

        if ((! res) || (! Array.isArray(res.user_permissions))) {
          return null;
        } else {
          return res.user_permissions;
        }
      }
    },
  }
);

const sharedUsersArraySchema = whiteboardSchema.path('user_permissions').schema;

sharedUsersArraySchema?.discriminator('user', new Schema<IWhiteboardUserPermissionById<Types.ObjectId>>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    // -- serialization options
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
    // -- instance methods
    methods: {
      async populateAttribs(): Promise<IWhiteboardUserPermissionById<IUser>> {
        return await this.populate([
          'user',
        ]);
      },
      async populateFull(): Promise<IWhiteboardUserPermissionById<IUser>> {
        return await this.populate([
          'user',
        ]);
      },
      toAttribView(): IWhiteboardUserPermissionById<IUserAttribView> {
        const obj = this.toObject({ virtuals: true });
        const {
          user: _user,
          ...fields
        } = obj;

        console.log('!! perm (toAttribView):', this);// TODO: remove debug

        return ({
          ...fields,
          user: (this as unknown as IWhiteboardUserPermissionById<IUser>).user.toAttribView(),
        });
      },
      toPublicView(): IWhiteboardUserPermissionById<IUserPublicView> {
        const obj = this.toObject({ virtuals: true });
        const {
          user: _user,
          ...fields
        } = obj;

        return ({
          ...fields,
          user: (this as unknown as IWhiteboardUserPermissionById<IUser>).user.toPublicView(),
        });
      },
    },
  },
));

sharedUsersArraySchema?.discriminator('email', new Schema<IWhiteboardUserPermissionByEmail>(
  {
    email: { type: String, required: true },
  },
  {
    // -- serialization options
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
    // -- instance methods
    methods: {
      async populateAttribs(): Promise<IWhiteboardUserPermissionByEmail> {
        return await this.populate([]);
      },
      async populateFull(): Promise<IWhiteboardUserPermissionByEmail> {
        return await this.populate([]);
      },
      toAttribView(): IWhiteboardUserPermissionByEmail {
        return this.toObject({ virtuals: true });
      },
      toPublicView(): IWhiteboardUserPermissionByEmail {
        return this.toObject({ virtuals: true });
      },
    },
  },
));

whiteboardSchema.virtual('id').get(function() {
  return this._id;
});

export const Whiteboard = model<
  IWhiteboard <Types.ObjectId, Types.ObjectId>,
  IWhiteboardSchema <Types.ObjectId, Types.ObjectId>
>("Whiteboard", whiteboardSchema, "whiteboards");
