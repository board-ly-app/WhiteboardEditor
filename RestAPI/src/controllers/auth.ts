import { Request, Response } from "express";
import { permanentUserLoginService } from "../services/loginService";
import type { AuthRequest } from "../models/Auth";

export const login = async (req: Request<{}, {}, AuthRequest>, res: Response) => {
  try {
    const { authSource, password } = req.body;

    const identifier = authSource === "email" ? req.body.email! : req.body.username!;
    const result = await permanentUserLoginService(authSource, identifier, password);

    res.status(200).json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};
