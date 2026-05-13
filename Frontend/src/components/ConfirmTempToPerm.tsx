import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export interface ConfirmTempToPermProps {
  onCancel: () => void,
  action: "login" | "signup",
}

const ConfirmTempToPerm = ({
  onCancel,
  action
}: ConfirmTempToPermProps) => {
  let message : string = "";
  let handleSubmit : (event: React.FormEvent<HTMLFormElement>) => void;

  const navigate = useNavigate();

  const url = new URL(window.location.href);
  const segments = url.pathname.split('/');
  const whiteboardId = segments.pop() || segments.pop();
  
  if (!whiteboardId) {
    console.error("No whiteboardId found in URL");
    return;
  }

  const encodedWhiteboardUrl = encodeURIComponent(`/whiteboard/${whiteboardId}`);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const redirectUrl = `/login/?transfer_temp_whiteboard=${whiteboardId}&redirect=${encodedWhiteboardUrl}`;

    navigate(redirectUrl);
  }

  const handleSingup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const redirectUrl = `/signup/?transfer_temp_whiteboard=${whiteboardId}&redirect=${encodedWhiteboardUrl}`;

    navigate(redirectUrl);
  }

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
    <div>
      <form
        onSubmit={handleSubmit}
      >
        <h1>{message}</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <Button
            type="submit"
          >
            Confirm
          </Button>
          <Button
            type="button"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ConfirmTempToPerm;