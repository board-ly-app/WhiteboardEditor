import { cn } from "@/lib/utils";

export interface ErrorTextNotificationProps {
  message: string;
  show?: boolean;
  className?: string;
}

const ErrorTextNotification = ({
  message,
  show = true,
  className,
}: ErrorTextNotificationProps): React.JSX.Element | null => {
  if (!show) {
    return null;
  }

  return (
    <p role="alert" className={cn("mt-1 text-xs text-red-500", className)}>
      {message}
    </p>
  );
};

export default ErrorTextNotification;