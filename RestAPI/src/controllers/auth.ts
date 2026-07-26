import {
  Request,
  Response,
} from "express";

import {
  AUTH_ROUTE,
  SESSION_ID_COOKIE_ID,
  REFRESH_TOKEN_COOKIE_ID,
  ACCESS_TOKEN_COOKIE_ID,
} from '../app.config';

import {
  type LoginPermanentUserRes,
  createAccessToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  verifyUserFromRefreshToken,
  loginPermanentUser,
} from "../services/authService";
import {
  generateCsrfToken,
} from '../services/antiCsrfService';
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
  user: IPermanentUserSelfView;
  sessionToken: string;
}

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
        const sessionToken = generateCsrfToken(req, res);
        const resp : PostLoginRouteOkRes = ({
          user: loginResult.user.toSelfView(),
          sessionToken,
        });

        setRefreshTokenCookie(res, loginResult.refreshToken);
        setAccessTokenCookie(res, loginResult.accessToken);

        return res.status(201)
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

export const handleLogout = (
  _req: Request,
  res: Response,
) => {
  // -- Don't bother verifying whether user has a valid refresh token; end
  // result will be the same regardless.
  return res.status(201)
    .clearCookie(SESSION_ID_COOKIE_ID, {
      sameSite: 'strict',
      httpOnly: true,
    })
    .clearCookie(REFRESH_TOKEN_COOKIE_ID, {
      path: `${AUTH_ROUTE}/refresh`,
      sameSite: 'strict',
      httpOnly: true,
    })
    .clearCookie(ACCESS_TOKEN_COOKIE_ID, {
      sameSite: 'strict',
      httpOnly: true,
    })
    .end();
};// -- end handleLogout

interface RefreshAccessTokenUnauthedRes {
  message: string;
}

interface RefreshAccessTokenServerErrRes {
  message: 'Internal server error.';
}

export const handleRefreshAccessToken = async (
  req: Request,
  res: Response
) => {
  try {
    // -- Check for refresh token
    const refreshTokenCookie = req.cookies[REFRESH_TOKEN_COOKIE_ID];

    if (! refreshTokenCookie) {
      return res.status(401).end();
    }

    const verifyUserRes = await verifyUserFromRefreshToken(refreshTokenCookie);

    switch (verifyUserRes.kind) {
      case 'no_user':
      case 'invalid_token':
      case 'malformed_token':
      {
        console.error('Could not verify user from refresh token: ', verifyUserRes.kind);

        const resp : RefreshAccessTokenUnauthedRes = ({
          message: 'Invalid or expired refresh token provided.',
        });
        return res.status(401).json(resp);
      }
      case 'ok':
      {
        const {
          user,
        } = verifyUserRes;
        const userId = user._id;
        const token = createAccessToken(userId);

        setAccessTokenCookie(res, token);
        return res.status(201).end();
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
