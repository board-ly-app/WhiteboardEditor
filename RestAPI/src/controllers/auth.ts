import {
  Request, Response,
} from "express";
import {
  loginPermanentUser,
} from "../services/loginService";
import {
  type AuthRequest,
} from "../models/Auth";
import {
  type IPermanentUserSelfView,
} from "../models/User";

interface PostLoginRouteBadRequestRes {
  message: string;
}

interface PostLoginRouteServerErrRes {
  message: 'An unexpected error occurred';
}

interface PostLoginRouteOkRes {
  token: string;
  user: IPermanentUserSelfView;
}

export const handleLogin = async (
  req: Request<{}, {}, AuthRequest>,
  res: Response
) => {
  try {
    const {
      authSource, password,
    } = req.body;

    const identifier = (authSource === "email") ? req.body.email : req.body.username;
    const loginResult = await loginPermanentUser(authSource, identifier, password);
    
    switch (loginResult.kind) {
      case 'bad_pass':
      case 'no_user':
      case 'no_perm_user':
      {
        // -- Don't specify whether or not the specified account exists; we
        // don't want third parties to be able to use this endpoint to determine
        // whether or not an account associated with a given email address
        // exists.
        if (process.env.NODE_ENV !== 'production') {
          console.error('Authentication error:', loginResult);
        }

        const resp : PostLoginRouteBadRequestRes = ({
          message: 'Invalid credentials provided',
        });

        return res.status(400).json(resp);
      }
      case 'other_err':
      {
        // -- Don't provide specifics on how the server failed; we don't want
        // attackers to be able to use the information to exploit the system.
        if (process.env.NODE_ENV !== 'production') {
          console.error('Server error:', loginResult.err);
        }

        const resp : PostLoginRouteServerErrRes = ({
          message: 'An unexpected error occurred',
        });

        return res.status(500).json(resp);
      }
      case 'ok':
      {
        const resp : PostLoginRouteOkRes = ({
          token: loginResult.accessToken,
          user: loginResult.user.toSelfView(),
        });

        return res.status(201).json(resp);
      }
      default:
        throw new Error(`Unrecognized login result type "${JSON.stringify(loginResult)}"`);
    }// -- end switch (loginResult.kind)
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Login error:', err);
    }

    const resp : PostLoginRouteServerErrRes = ({
      message: 'An unexpected error occurred',
    });

    return res.status(500).json(resp);
  }
};// -- end handleLogin
