import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { AppModal } from "./ui/app-modal";
import { useCallback } from "react";

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

  const url = new URL(window.location.href);
  const segments = url.pathname.split('/');
  const whiteboardId = segments.pop() || segments.pop();

  if (! whiteboardId) {
    throw new Error('No whiteboardId found in URL');
  }

  const encodedWhiteboardUrl = encodeURIComponent(`/whiteboard/${whiteboardId}`);

  const handleLogin = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const redirectUrl = `/login/?transfer_temp_whiteboard=${whiteboardId}&redirect=${encodedWhiteboardUrl}`;

    navigate(redirectUrl);
  }, [navigate, whiteboardId, encodedWhiteboardUrl]);

  const handleSingup = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const redirectUrl = `/signup/?transfer_temp_whiteboard=${whiteboardId}&redirect=${encodedWhiteboardUrl}`;

    navigate(redirectUrl);
  }, [navigate, whiteboardId, encodedWhiteboardUrl]);

  switch (action) {
    case 'login':
      message = "Logging in will transfer ownership of this whiteboard to your permanent account.";
      handleSubmit = handleLogin;
      break;
    case 'signup':
      message = "Signing up will transfer ownership of this whiteboard to your new account.";
      handleSubmit = handleSingup;
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
