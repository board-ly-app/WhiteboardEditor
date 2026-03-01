import {
  useState,
} from 'react';

import type {
  PropsWithChildren,
} from 'react';

export interface ModalProps {
  className?: string;
  zIndex?: number;
}

export interface UseModalResult {
  Modal: (props: PropsWithChildren<ModalProps>) => React.JSX.Element | null;
  openModal: () => void;
  closeModal: () => void;
}

export const useModal = (): UseModalResult => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const openModal = () => { setIsOpen(true); };
  const closeModal = () => { setIsOpen(false); };
  const Modal = ({
    className,
    zIndex,
    children,
  }: PropsWithChildren<ModalProps>): React.JSX.Element | null => {
    if (! isOpen) {
      return null;
    } else {
      const zIndexBg = zIndex || 500;

      return (
        <>
          {/** Opaque background **/}
          <div
            className="fixed inset-0 w-full h-full bg-black opacity-50"
            style={{ zIndex: zIndexBg }}
          />

          {/** Wrapper around Modal to ensure proper position **/}
          <div
            className="fixed inset-0 flex justify-center items-center w-full h-full"
            style={{ zIndex: zIndexBg + 1 }}
          >
            {/** Actual Modal **/}
            <div
              className={`fixed bg-popover text-popover-foreground ${className}`}
            >
              {children}
            </div>
          </div>
        </>
      );
    }
  };

  return ({ Modal, openModal, closeModal });
};
