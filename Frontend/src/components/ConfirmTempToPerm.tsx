import {
  useCallback,
  useContext,
} from "react";

import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { AppModal } from "./ui/app-modal";

import WhiteboardContext from '@/context/WhiteboardContext';

const FORM_ID = 'confirm-temp-to-perm-form';

export interface ConfirmTempToPermProps {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  action: "login" | "signup",
}

const ConfirmTempToPerm = ({
  open,
  onOpenChange,
  action
}: ConfirmTempToPermProps) => {
  let message : string = "";
  let handleSubmit : (event: React.FormEvent<HTMLFormElement>) => void;

  const navigate = useNavigate();

  const whiteboardContext = useContext(WhiteboardContext);
  const whiteboardId = whiteboardContext?.whiteboardId ?? null;

  const encodedWhiteboardUrl = encodeURIComponent(`/whiteboard/${whiteboardId}`);

  const handleLogin = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (! whiteboardId) return;

    const urlSearchParams = new URLSearchParams({
      'transfer_temp_whiteboard': whiteboardId,
      'redirect': encodedWhiteboardUrl,
    });
    const redirectUrl = `/login/?${urlSearchParams.toString()}`;

    navigate(redirectUrl);
  }, [navigate, whiteboardId, encodedWhiteboardUrl]);

  const handleSignup = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (! whiteboardId) return;

    const urlSearchParams = new URLSearchParams({
      'transfer_temp_whiteboard': whiteboardId,
      'redirect': encodedWhiteboardUrl,
    });
    const redirectUrl = `/signup/?${urlSearchParams.toString()}`;

    navigate(redirectUrl);
  }, [navigate, whiteboardId, encodedWhiteboardUrl]);

  switch (action) {
    case 'login':
      message = "Logging in will transfer ownership of this whiteboard to your permanent account.";
      handleSubmit = handleLogin;
      break;
    case 'signup':
      message = "Signing up will transfer ownership of this whiteboard to your new account.";
      handleSubmit = handleSignup;
      break;
    default:
      throw new Error(`unrecognized action: ${action}`);
  }

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer whiteboard ownership"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            form={FORM_ID} 
            type="submit"
            className="border bg-card-background"
          >
            Confirm
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <p>{message}</p>
      </form>
    </AppModal>
  );
};

export default ConfirmTempToPerm;
