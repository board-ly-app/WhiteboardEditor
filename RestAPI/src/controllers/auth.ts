import {
  Request, Response,
} from "express";

import {
  AUTH_ROUTE,
} from '../app.config';

import {
  type LoginPermanentUserRes,
  createAccessToken,
  verifyUserFromToken,
  loginPermanentUser,
} from "../services/authService";
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

const REFRESH_TOKEN_COOKIE_ID = 'refresh_token';

if (! process.env.REFRESH_TOKEN_EXPIRATION_SECS) {
  throw new Error('Env var REFRESH_TOKEN_EXPIRATION_SECS not set');
}

const REFRESH_TOKEN_EXPIRATION_SECS = parseInt(process.env.REFRESH_TOKEN_EXPIRATION_SECS);

export const handleLogin = async (
  req: Request<{}, {}, AuthRequest>,
  res: Response
) => {
  try {
    if (! req.body?.password) {
      const resp : PostLoginRouteBadRequestRes = ({
        message: "No password provided",
      });
      return res.status(400).json(resp);
    }

    let loginResult : LoginPermanentUserRes;

    switch (req.body?.authSource) {
      case 'email':
        if (! req.body.email) {
          const resp : PostLoginRouteBadRequestRes = ({
            message: "No email address provided",
          });
          return res.status(400).json(resp);
        } else {
          loginResult = await loginPermanentUser(
            req.body.authSource, req.body.email, req.body.password
          );
        }
        break;
      case 'username':
        if (! req.body.username) {
          const resp : PostLoginRouteBadRequestRes = ({
            message: "No email address provided",
          });
          return res.status(400).json(resp);
        } else {
          loginResult = await loginPermanentUser(
            req.body.authSource, req.body.username, req.body.password
          );
        }
        break;
      default:
      {
        const resp : PostLoginRouteBadRequestRes = ({
          message: "No valid authSource provided",
        });
        return res.status(400).json(resp);
      }
    }// -- end switch (authSource)
    
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

        return res.status(201)
          .cookie(REFRESH_TOKEN_COOKIE_ID, loginResult.refreshToken, {
            path: `${AUTH_ROUTE}/refresh`,
            httpOnly: true,
            maxAge: REFRESH_TOKEN_EXPIRATION_SECS * 1_000,
          })
          .json(resp);
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

interface RefreshAccessTokenUnauthedRes {
  message: string;
}

interface RefreshAccessTokenServerErrRes {
  message: 'Internal server error.';
}

interface RefreshAccessTokenOkRes {
  token: string;
}

export const handleRefreshAccessToken = async (
  req: Request,
  res: Response
) => {
  try {
    // -- Check for refresh token
    const refreshTokenCookie = req.cookies[REFRESH_TOKEN_COOKIE_ID];

    if (! refreshTokenCookie) {
      return res.status(403).end();
    }

    const verifyUserRes = await verifyUserFromToken(refreshTokenCookie);

    switch (verifyUserRes.kind) {
      case 'no_user':
      case 'invalid_token':
      {
        const resp : RefreshAccessTokenUnauthedRes = ({
          message: 'Invalid or expired refresh token provided.',
        });
        return res.status(400).json(resp);
      }
      case 'ok':
      {
        const {
          user,
        } = verifyUserRes;
        const userId = user._id;
        const token = createAccessToken(userId);
        const resp : RefreshAccessTokenOkRes = ({
          token,
        });

        return res.status(201).json(resp);
      }
    }// -- end switch (verifyUserRes.kind)
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error: ', e);
    } else {
      console.error('Unexpected error');
    }

    const resp : RefreshAccessTokenServerErrRes = ({
      message: 'Internal server error.',
    });
    return res.status(500).json(resp);
  }
};// -- end handleRefreshAccessToken
